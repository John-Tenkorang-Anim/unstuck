"""Media workers (F-04, INV-14). Image, video, PDF and CSV handlers live beside this module."""
import asyncio


async def main() -> None:
    # Week 5 wires runtime.run("jobs:media", "worker-media", dispatch).
    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
