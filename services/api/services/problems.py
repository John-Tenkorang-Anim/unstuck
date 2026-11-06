"""Problem resolution follows authorized, evidence-backed state transitions."""
from datetime import timedelta
from domain.errors import ValidationFailed
from domain.enums import ProblemState
from domain.states import PROBLEM_MACHINE
from services.search import SearchService
from settings import get_settings


class ProblemService:
    def __init__(self, repo):
        self.repo = repo

    async def similar_before_posting(self, draft):
        return await SearchService(self.repo).search(draft.title, limit=5)

    async def mark_solved(self, actor, problem_id, by, target_id):
        async with self.repo.lock:
            entry = self.repo.entry(problem_id, actor, own=True)
            if entry.kind != 'problem' or entry.status != 'published':
                raise ValidationFailed('a published problem is required')
            if by == 'answer':
                answer = self.repo.comments.get(target_id)
                if not answer or answer['entry_id'] != problem_id or answer['view'].type != 'answer':
                    raise ValidationFailed('answer must belong to this problem')
            elif by == 'solution':
                solution = self.repo.entry(target_id)
                if solution.kind != 'solution' or not any(
                    link.rel == 'solves' and link.to_id == problem_id for link in solution.links):
                    raise ValidationFailed('solution must link to this problem')
            else:
                raise ValidationFailed('invalid resolution type')
            previous, destination = PROBLEM_MACHINE.resolve(entry.problem_state, 'solve', {'asker'})
            entry.problem_state = ProblemState(destination)
            self.repo.resolutions[problem_id] = (by, target_id)
            self.repo.state_events.append({'entity': 'problem', 'id': str(problem_id),
                                           'from': previous, 'to': destination})
            self.repo.emit(entry)
            return entry.model_copy(deep=True)

    async def unmark_solved(self, actor, problem_id, note):
        async with self.repo.lock:
            entry = self.repo.entry(problem_id, actor, own=True)
            previous, destination = PROBLEM_MACHINE.resolve(entry.problem_state, 'unmark', {'asker'}, note=note)
            entry.problem_state = ProblemState(destination)
            self.repo.resolutions.pop(problem_id, None)
            self.repo.state_events.append({'entity': 'problem', 'id': str(problem_id),
                                           'from': previous, 'to': destination})
            self.repo.emit(entry)
            return entry.model_copy(deep=True)

    async def sweep(self, now):
        changed = []
        async with self.repo.lock:
            for entry in self.repo.entries.values():
                last_activity = self.repo.activity.get(entry.id, entry.published_at)
                if (entry.status == 'published' and entry.kind == 'problem' and
                    entry.problem_state in ('open', 'answered') and last_activity and
                    now - last_activity >= timedelta(days=get_settings().PROBLEM_STALE_DAYS)):
                    previous = entry.problem_state
                    entry.problem_state = ProblemState.STALE
                    self.repo.state_events.append({'entity': 'problem', 'id': str(entry.id),
                                                   'from': previous, 'to': 'stale'})
                    self.repo.emit(entry)
                    changed.append(entry.id)
        return changed
