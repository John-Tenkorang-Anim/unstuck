from uuid import uuid4
import pytest
from adapters.memory import MemoryRepository
from domain.errors import Conflict, Forbidden, NotFound
from domain.models import EntryCreate, OutcomeReportCreate, RevisionDraft
from services._actor import Account
from services.entries import EntryService
from services.knowledge import KnowledgeService
from services.outcomes import OutcomeService


async def test_T72_AI_draft_human_acceptance_strengths_and_stale_revisions():
    repo = MemoryRepository()
    author, reviewer = Account(uuid4()), Account(uuid4(), trust_score=3)
    entries, knowledge = EntryService(repo), KnowledgeService(repo)
    entry = await entries.create_draft(author, EntryCreate(kind='experience', template='everyday',
        title='Ventilation reduced spoilage', goal='Preserve food', approach='Use an open basket',
        result='Less spoilage', outcome='worked', lang='en'), 'entry')
    await entries.publish(author, entry.id)
    for country in ('GH', 'KE', 'GH'):
        await OutcomeService(repo).report(Account(uuid4()), entry.id,
            OutcomeReportCreate(verdict='same_for_me', context={'country': country}))
    draft = RevisionDraft(title='Storing tomatoes with ventilation', ai_generated=True,
        claims=[{'section': 'what_works', 'text': 'Ventilation helped in these reports.',
                 'citations': [{'target_type': 'entry', 'target_id': entry.id}]}])
    revision = await knowledge.propose_revision(None, 'tomato-storage', draft)
    with pytest.raises(NotFound):
        await knowledge.get('tomato-storage')
    concurrent = await knowledge.propose_revision(author, 'tomato-storage', draft)
    with pytest.raises(Forbidden):
        await knowledge.decide(author, concurrent.id, True, 'My own revision')
    accepted = await knowledge.decide(reviewer, revision.id, True, 'Checked the reports')
    assert accepted.ai_generated
    assert accepted.claims[0].strength == 'consistent'
    assert (await knowledge.get('tomato-storage')).id == revision.id
    with pytest.raises(Conflict):
        await knowledge.decide(reviewer, concurrent.id, True, 'Stale base')
    await entries.delete(author, entry.id)
    with pytest.raises(NotFound):
        await knowledge.get('tomato-storage')
