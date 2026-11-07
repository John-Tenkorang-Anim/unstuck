"""Exactly one current tried-it report per account and entry."""
from adapters.repository import CoreRepository
from domain.enums import ALLOWED_VERDICTS
from domain.errors import Forbidden, ValidationFailed
from domain.validation import validate_context
from settings import get_settings


class OutcomeService:
    def __init__(self, repo: CoreRepository):
        self.repo = repo

    async def report(self, actor, entry_id, data):
        async with self.repo.transaction() as tx:
            actor = await tx.check_actor(actor)
            record = await tx.load_entry(entry_id, lock=True)
            entry = record.view
            if record.author_id == actor.id:
                raise Forbidden('authors cannot report on their own entry')
            if data.verdict not in ALLOWED_VERDICTS[entry.kind]:
                raise ValidationFailed('verdict is not allowed for this entry kind')
            validate_context(data.context, entry.template)
            fields = {'same_for_me': 'same_count', 'not_for_me': 'not_same_count',
                      'worked_for_me': 'worked_count', 'didnt_work_for_me': 'didnt_work_count',
                      'solved_for_me': 'solved_for_count'}
            old = await tx.get_report(entry_id, actor.id)
            if old is not None:
                field = fields[old.verdict]
                setattr(entry.stats, field, getattr(entry.stats, field) - 1)
            await tx.put_report(entry_id, actor.id, data)
            field = fields[data.verdict]
            setattr(entry.stats, field, getattr(entry.stats, field) + 1)
            await tx.save_entry(entry)
            await tx.emit(entry)
            return entry.stats.model_copy(deep=True)


class ImpactService:
    def __init__(self, repo: CoreRepository):
        self.repo = repo

    async def helped(self, actor, target, kind, saved_note=None):
        target_type, target_id = target
        if target_type != 'entry' or kind not in ('helped', 'saved'):
            raise ValidationFailed('invalid impact target or kind')
        if saved_note is not None and len(saved_note) > 280:
            raise ValidationFailed('saved note must be at most 280 characters')
        async with self.repo.transaction() as tx:
            actor = await tx.check_actor(actor)
            record = await tx.load_entry(target_id, lock=True)
            entry = record.view
            if record.author_id == actor.id:
                raise Forbidden('authors cannot record impact on their own entry')
            old = await tx.get_signal(target_id, actor.id)
            if old:
                field = old + '_count'
                setattr(entry.stats, field, getattr(entry.stats, field) - 1)
            await tx.put_signal(target_id, actor.id, kind, saved_note)
            field = kind + '_count'
            setattr(entry.stats, field, getattr(entry.stats, field) + 1)
            await tx.save_entry(entry)
            await tx.emit(entry)
            return entry.stats.model_copy(deep=True)

    async def my_impact(self, actor):
        async with self.repo.transaction(readonly=True) as tx:
            actor = await tx.check_actor(actor)
            people, counts = await tx.impact(actor.id)
            if people < get_settings().IMPACT_MIN_GROUP:
                return {'label': 'not enough reports'}
            return counts
