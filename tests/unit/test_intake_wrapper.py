import asyncio
import json
from pathlib import Path
import pytest
from workers.media import intake
from workers.runtime import Permanent


class Process:
    pid = 1
    returncode = 0

    def __init__(self, report):
        self.stdout = asyncio.StreamReader()
        self.stdout.feed_data(json.dumps(report).encode())
        self.stdout.feed_eof()

    async def wait(self):
        return self.returncode


async def test_intake_validates_output_paths_and_contract(monkeypatch, tmp_path):
    source = tmp_path / 'original'
    source.write_bytes(b'original bytes')
    output = tmp_path / 'clean'
    output.mkdir()
    (output / 'clean.png').write_bytes(b'sanitized bytes')
    report = {'v': 1, 'ok': True, 'kind': 'image', 'outputs': ['clean.png'], 'removed': ['EXIF']}
    calls = []

    async def spawn(*args, **kwargs):
        calls.append((args, kwargs))
        return Process(report)

    monkeypatch.setattr(intake.asyncio, 'create_subprocess_exec', spawn)
    result = await intake.run_intake('image', source, output, 'image/png', {'max_pixels': 40_000_000})
    assert result['outputs'] == ['clean.png']
    assert calls[0][0][1:4] == ('sanitize', '--kind', 'image')
    assert calls[0][1]['start_new_session']
    assert set(calls[0][1]['env']) == {'PATH'}
    report['outputs'] = ['../original']
    with pytest.raises(Permanent):
        await intake.run_intake('image', source, output, 'image/png', {})
    report['outputs'] = ['clean.png']
    report['unexpected'] = 'untrusted'
    with pytest.raises(Permanent):
        await intake.run_intake('image', source, output, 'image/png', {})
