"""PDF pipeline. Spec 10.21. Reads only intake's clean.pdf (INV-14)."""
from workers.runtime import Permanent


async def process_pdf(job, blob, repo) -> None:
    raise Permanent("process_pdf is not implemented")
