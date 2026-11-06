"""Bounded POSIX wrapper for the Rust intake trust boundary (INV-14).

Deploy this worker in the specified network-disabled sandbox. Resource limits do
not themselves provide network isolation. Downstream parsers use only outputs.
"""
import asyncio
import json
import os
from pathlib import Path
import resource
import signal
from typing import Literal

from pydantic import BaseModel, ConfigDict, ValidationError
from settings import get_settings
from workers.runtime import Permanent


class IntakeReport(BaseModel):
    model_config = ConfigDict(extra='forbid')
    v: Literal[1]
    ok: bool
    kind: Literal['image', 'pdf', 'csv', 'av']
    outputs: list[str]
    removed: list[str]
    detected_mime: str | None = None
    sha256: str | None = None
    width: int | None = None
    height: int | None = None
    pages: int | None = None
    rows: int | None = None
    reject_reason: Literal['type_mismatch', 'too_large', 'too_many_pixels', 'too_many_pages',
                           'too_many_rows', 'malformed', 'encrypted', 'unsupported'] | None = None


def _resource_limits():
    for kind, limit in ((resource.RLIMIT_AS, 512 * 2**20), (resource.RLIMIT_CPU, 20),
                        (resource.RLIMIT_NOFILE, 32), (resource.RLIMIT_FSIZE, 200 * 2**20)):
        resource.setrlimit(kind, (limit, limit))


async def run_intake(kind: str, in_path: Path, out_dir: Path, declared_mime: str, limits) -> dict:
    if kind not in ('image', 'pdf', 'csv', 'av'):
        raise Permanent('unsupported intake kind')
    source = in_path.resolve(strict=True)
    output = out_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    if not source.is_file() or source.is_relative_to(output):
        raise Permanent('invalid intake input path')
    settings = get_settings()
    arguments = [settings.INTAKE_BIN, 'sanitize', '--kind', kind, '--in', str(source),
                 '--out-dir', str(output), '--declared-mime', declared_mime]
    allowed = {'max_bytes', 'max_pixels', 'max_pages', 'max_rows'}
    values = limits if isinstance(limits, dict) else vars(limits)
    for key, value in values.items():
        if key not in allowed or type(value) is not int or value <= 0:
            raise Permanent('invalid intake limit')
        arguments.extend(['--' + key.replace('_', '-'), str(value)])
    process = await asyncio.create_subprocess_exec(*arguments, cwd=output,
        env={'PATH': settings.INTAKE_SUBPROCESS_PATH}, preexec_fn=_resource_limits,
        start_new_session=True, stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL)
    try:
        async with asyncio.timeout(30):
            chunks, total = [], 0
            while chunk := await process.stdout.read(65536):
                total += len(chunk)
                if total > 2**20:
                    raise Permanent('intake report exceeded its size limit')
                chunks.append(chunk)
            await process.wait()
    except BaseException as exc:
        if process.returncode is None:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        await process.wait()
        if isinstance(exc, TimeoutError):
            raise RuntimeError('intake timed out') from None
        raise
    if process.returncode not in (0, 2):
        raise RuntimeError('intake process failed')
    try:
        report = IntakeReport.model_validate(json.loads(b''.join(chunks)), strict=True)
    except (ValueError, UnicodeError, ValidationError):
        raise Permanent('invalid intake report') from None
    if report.kind != kind:
        raise Permanent('intake reported the wrong media kind')
    if not report.ok or process.returncode != 0:
        raise Permanent(report.reject_reason or 'intake rejected the uploaded file')
    if not report.outputs and kind != 'av':
        raise Permanent('intake returned no sanitized files')
    for name in report.outputs:
        try:
            candidate = (output / name).resolve(strict=True)
        except OSError:
            raise Permanent('intake output is missing') from None
        if not candidate.is_relative_to(output) or not candidate.is_file() or candidate == source:
            raise Permanent('intake output escaped its directory')
    return report.model_dump()
