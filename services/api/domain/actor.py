"""Internal authenticated actor; never serialize into public responses."""
from datetime import datetime, timezone
from uuid import UUID


class Account:
    def __init__(self, id: UUID, status: str = 'active', trust_score: float = 1.0,
                 is_moderator: bool = False, created_at: datetime | None = None):
        self.id = id
        self.status = status
        self.trust_score = trust_score
        self.is_moderator = is_moderator
        self.created_at = created_at or datetime.now(timezone.utc)
