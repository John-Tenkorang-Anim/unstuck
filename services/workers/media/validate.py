"""Declared limits before a file reaches intake. Spec F-04."""

LIMITS = {
    "image": 15 * 2**20,
    "video": 100 * 2**20,
    "pdf": 20 * 2**20,
    "csv": 5 * 2**20,
    "code": 200 * 2**10,
    "audio_note": 10 * 2**20,
}
MAX_IMAGES_PER_ENTRY = 8
MAX_VIDEO_SECONDS = 60
