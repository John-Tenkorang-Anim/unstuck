"""CSV pipeline. Spec 10.21."""
from workers.runtime import Permanent


async def process_csv(job, blob, repo) -> None:
    raise Permanent("process_csv is not implemented")
