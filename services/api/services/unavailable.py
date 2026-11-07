"""Fail closed while a workflow still needs its persistent implementation."""
from domain.errors import NotBuilt


class UnavailableWorkflow:
    def __init__(self, name):
        self.name = name

    async def unavailable(self, *args, **kwargs):
        raise NotBuilt(f'{self.name} requires its persistent storage integration')

    promote = vote = add_evidence = transition = unavailable
    get = propose_revision = decide = unavailable
    request_upload = finalize = patch = approve = reject = unavailable
