"""worker-media video pipeline. Spec 10.20. Week 6."""
from workers.runtime import Permanent


async def process_video(job, blob, repo) -> None:
    raise Permanent("process_video is not implemented")
