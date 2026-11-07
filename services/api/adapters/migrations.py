"""Explicit, checksummed migrations; applications never apply DDL on startup."""
from hashlib import sha256
from pathlib import Path

import psycopg

REQUIRED_SCHEMA = '0003_context_keys.sql'
MIGRATION_LOCK = 751824246508344199  # dedicated transaction-scoped migration lock


async def migrate(dsn: str, directory: Path) -> list[str]:
    files = sorted(directory.glob('[0-9][0-9][0-9][0-9]_*.sql'))
    if not files or files[-1].name != REQUIRED_SCHEMA:
        raise RuntimeError('migration directory does not match this application version')
    async with await psycopg.AsyncConnection.connect(dsn, connect_timeout=5) as conn:
        async with conn.transaction():
            await conn.execute('SELECT pg_advisory_xact_lock(%s)', (MIGRATION_LOCK,))
            await conn.execute('''CREATE TABLE IF NOT EXISTS schema_migrations (
                name text PRIMARY KEY, sha256 text NOT NULL,
                applied_at timestamptz NOT NULL DEFAULT now())''')
            applied = dict(await (await conn.execute(
                'SELECT name, sha256 FROM schema_migrations ORDER BY name')).fetchall())
            if set(applied) - {path.name for path in files}:
                raise RuntimeError('database contains migrations unknown to this application')
            changed = []
            for path in files:
                data = path.read_bytes()
                digest = sha256(data).hexdigest()
                if path.name in applied:
                    if applied[path.name] != digest:
                        raise RuntimeError(f'applied migration was modified: {path.name}')
                    continue
                if applied and path.name < max(applied):
                    raise RuntimeError('migrations cannot be inserted before applied versions')
                await conn.execute(data.decode('utf-8'), prepare=False)
                await conn.execute('INSERT INTO schema_migrations(name, sha256) VALUES (%s, %s)',
                                   (path.name, digest))
                changed.append(path.name)
            return changed
