"""worker-media image pipeline. Implemented in week 5. Spec 10.19."""
from workers.runtime import Permanent

__all__ = ["Permanent", "process_image"]


async def process_image(job, blob, repo) -> None:
    """Sanitize with Rust intake, then variants. See docs/SPEC.md 10.19."""
    raise Permanent("process_image is not implemented")
