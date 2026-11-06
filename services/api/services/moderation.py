"""Moderation queue (F-20). Actions: hide, remove, warn, limit, suspend. Week 13."""
from domain.errors import NotBuilt
from services._actor import Account


class ModerationService:
    async def report(self, actor: Account, target_type: str, target_id, reason: str, detail: str | None):
        raise NotBuilt("moderation.report")

    async def act(self, moderator: Account, report_id, action: str, explanation: str):
        raise NotBuilt("moderation.act")

    async def appeal(self, actor: Account, action_id, note: str):
        raise NotBuilt("moderation.appeal")
