"""Problem resolution follows authorized, evidence-backed state transitions."""
from datetime import timedelta
from adapters.repository import CoreRepository
from domain.errors import ValidationFailed
from domain.enums import ProblemState
from domain.states import PROBLEM_MACHINE
from services.search import SearchService
from settings import get_settings


class ProblemService:
    def __init__(self, repo: CoreRepository):
        self.repo = repo

    async def similar_before_posting(self, draft):
        return await SearchService(self.repo).search(draft.title, limit=5)

    async def mark_solved(self, actor, problem_id, by, target_id):
        async with self.repo.transaction() as tx:
            actor = await tx.check_actor(actor)
            await tx.lock_entries([problem_id, target_id] if by == 'solution' else [problem_id])
            entry = (await tx.load_entry(problem_id, actor, own=True)).view
            if entry.kind != 'problem' or entry.status != 'published':
                raise ValidationFailed('a published problem is required')
            if by == 'answer':
                answer = await tx.get_comment(target_id)
                if not answer or answer['entry_id'] != problem_id or answer['view'].type != 'answer':
                    raise ValidationFailed('answer must belong to this problem')
            elif by == 'solution':
                solution = (await tx.load_entry(target_id)).view
                if solution.kind != 'solution' or not any(
                    link.rel == 'solves' and link.to_id == problem_id for link in solution.links):
                    raise ValidationFailed('solution must link to this problem')
            else:
                raise ValidationFailed('invalid resolution type')
            previous, destination = PROBLEM_MACHINE.resolve(entry.problem_state, 'solve', {'asker'})
            entry.problem_state = ProblemState(destination)
            await tx.put_resolution(problem_id, by, target_id)
            await tx.save_entry(entry)
            await tx.event('problem', problem_id, previous, destination, actor)
            await tx.emit(entry)
            return entry.model_copy(deep=True)

    async def unmark_solved(self, actor, problem_id, note):
        async with self.repo.transaction() as tx:
            actor = await tx.check_actor(actor)
            entry = (await tx.load_entry(problem_id, actor, own=True, lock=True)).view
            if entry.kind != 'problem' or entry.status != 'published':
                raise ValidationFailed('a published problem is required')
            previous, destination = PROBLEM_MACHINE.resolve(entry.problem_state, 'unmark', {'asker'}, note=note)
            entry.problem_state = ProblemState(destination)
            await tx.put_resolution(problem_id, None, None)
            await tx.save_entry(entry)
            await tx.event('problem', problem_id, previous, destination, actor, note)
            await tx.emit(entry)
            return entry.model_copy(deep=True)

    async def sweep(self, now):
        changed = []
        async with self.repo.transaction() as tx:
            records = await tx.stale_entries(now - timedelta(days=get_settings().PROBLEM_STALE_DAYS), 100)
            for record in records:
                entry = record.view
                previous = entry.problem_state
                entry.problem_state = ProblemState.STALE
                await tx.save_entry(entry)
                await tx.event('problem', entry.id, previous, 'stale')
                await tx.emit(entry)
                changed.append(entry.id)
        return changed
