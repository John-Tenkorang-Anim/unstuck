"""Trials (F-09). Schema is in v1.0; behavior is v1.1."""
from domain.errors import NotBuilt
from services._actor import Account


class TrialService:
    async def create(self, actor: Account, payload: dict):
        raise NotBuilt("trials.create")

    async def join(self, actor: Account, trial_id):
        raise NotBuilt("trials.join")
