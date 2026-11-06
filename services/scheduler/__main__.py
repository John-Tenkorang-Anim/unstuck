"""Scheduler process. Week 1 it only stays alive; cron jobs arrive with the features."""
import asyncio


async def main() -> None:
    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
