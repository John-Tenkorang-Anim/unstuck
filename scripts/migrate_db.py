"""Run from a repository checkout after installing services; never prints the DSN."""
import asyncio
from pathlib import Path

from adapters.migrations import migrate
from settings import get_settings


async def main():
    directory = Path(__file__).resolve().parents[1] / 'db' / 'migrations'
    applied = await migrate(get_settings().DATABASE_URL, directory)
    print('Applied: ' + ', '.join(applied) if applied else 'Schema is current.')


if __name__ == '__main__':
    asyncio.run(main())
