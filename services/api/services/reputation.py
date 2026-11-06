"""Internal trust score (F-21). Never displayed. Week 13."""
from uuid import UUID

from domain.errors import NotBuilt


class ReputationService:
    async def adjust(self, account_id: UUID, delta: float, reason: str) -> float:
        raise NotBuilt("reputation.adjust")
