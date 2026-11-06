"""Exactly one current tried-it report per account and entry."""
from domain.enums import ALLOWED_VERDICTS, EntryStatus
from domain.errors import Forbidden, ValidationFailed
from domain.validation import validate_context
from settings import get_settings


class OutcomeService:
    def __init__(self, repo):
        self.repo = repo

    async def report(self, actor, entry_id, data):
        self.repo.active(actor)
        async with self.repo.lock:
            entry = self.repo.entry(entry_id)
            if self.repo.owners[entry_id] == actor.id:
                raise Forbidden('authors cannot report on their own entry')
            if data.verdict not in ALLOWED_VERDICTS[entry.kind]:
                raise ValidationFailed('verdict is not allowed for this entry kind')
            validate_context(data.context, entry.template)
            key = (entry_id, actor.id)
            fields = {'same_for_me': 'same_count', 'not_for_me': 'not_same_count',
                      'worked_for_me': 'worked_count', 'didnt_work_for_me': 'didnt_work_count',
                      'solved_for_me': 'solved_for_count'}
            old = self.repo.reports.get(key)
            if old is not None:
                field = fields[old.verdict]
                setattr(entry.stats, field, getattr(entry.stats, field) - 1)
            self.repo.reports[key] = data.model_copy(deep=True)
            field = fields[data.verdict]
            setattr(entry.stats, field, getattr(entry.stats, field) + 1)
            self.repo.emit(entry)
            return entry.stats.model_copy(deep=True)


class ImpactService:
    def __init__(self, repo):
        self.repo = repo
        self.signals = {}

    async def helped(self, actor, target, kind, saved_note=None):
        self.repo.active(actor)
        target_type, target_id = target
        if target_type != 'entry' or kind not in ('helped', 'saved'):
            raise ValidationFailed('invalid impact target or kind')
        async with self.repo.lock:
            entry = self.repo.entry(target_id)
            if self.repo.owners[target_id] == actor.id:
                raise Forbidden('authors cannot record impact on their own entry')
            key = (actor.id, target_id)
            old = self.signals.get(key)
            if old:
                field = old + '_count'
                setattr(entry.stats, field, getattr(entry.stats, field) - 1)
            self.signals[key] = kind
            field = kind + '_count'
            setattr(entry.stats, field, getattr(entry.stats, field) + 1)
            self.repo.emit(entry)
            return entry.stats.model_copy(deep=True)

    async def my_impact(self, actor):
        self.repo.active(actor)
        targets = {key for key, owner in self.repo.owners.items() if owner == actor.id}
        signals = [(who, kind) for (who, target), kind in self.signals.items() if target in targets]
        if len({who for who, _ in signals}) < get_settings().IMPACT_MIN_GROUP:
            return {'label': 'not enough reports'}
        return {'helped': sum(kind == 'helped' for _, kind in signals),
                'saved': sum(kind == 'saved' for _, kind in signals)}
