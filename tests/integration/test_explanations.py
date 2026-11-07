from datetime import datetime, timedelta, timezone
from uuid import uuid4
import pytest

from adapters.memory import MemoryRepository
from domain.errors import Forbidden, ValidationFailed
from domain.models import CommentCreate, EntryCreate
from domain.actor import Account
from services.discussion import DiscussionService
from services.entries import EntryService
from services.explanations import ExplanationService


async def test_T71_evidence_verification_and_T31_conflict_of_interest():
    repo = MemoryRepository()
    author = Account(uuid4())
    entries, discussion, why = EntryService(repo), DiscussionService(repo), ExplanationService(repo)
    entry = await entries.create_draft(author, EntryCreate(kind='experience', template='everyday',
        title='Tomatoes spoiled in the bag', goal='Preserve food', approach='Sealed plastic bag',
        result='Spoiled quickly', outcome='failed', lang='en'), 'entry')
    await entries.publish(author, entry.id)
    hypothesis = await discussion.post(author, entry.id,
        CommentCreate(type='hypothesis', body_md='Moisture built up', lang='en'), 'hypothesis')
    explanation = await why.promote(author, hypothesis.id)
    assert (await why.promote(author, hypothesis.id)).id == explanation.id
    fresh = Account(uuid4())
    assert (await why.vote(fresh, explanation.id, True)).state == 'proposed'
    assert repo.entries[entry.id].why_status == 'unknown'
    contributors = [Account(uuid4(), trust_score=3,
                           created_at=datetime.now(timezone.utc) - timedelta(days=8)) for _ in range(2)]
    for i, contributor in enumerate(contributors):
        comment = await discussion.post(contributor, entry.id,
            CommentCreate(type='evidence', body_md='Repeated the experiment', lang='en'), f'evidence-{i}')
        explanation = await why.add_evidence(contributor, explanation.id, comment.id, 'supports', 'replication')
    assert explanation.state == 'supported'
    assert repo.entries[entry.id].why_status == 'suspected'
    with pytest.raises(Forbidden):
        await why.transition(contributors[0], explanation.id, 'verify')
    reviewer = Account(uuid4(), trust_score=3)
    explanation = await why.transition(reviewer, explanation.id, 'verify')
    assert explanation.state == 'verified'
    assert repo.entries[entry.id].why_status == 'verified'
    assert (await why.vote(fresh, explanation.id, False)).state == 'verified'
    for i in range(2):
        opponent = Account(uuid4())
        comment = await discussion.post(opponent, entry.id,
            CommentCreate(type='evidence', body_md='Contradicting measurement', lang='en'), f'opposing-{i}')
        explanation = await why.add_evidence(opponent, explanation.id, comment.id, 'contradicts', 'measurement')
    assert explanation.state == 'disputed'
    assert repo.entries[entry.id].why_status == 'unknown'
    explanation = await why.transition(reviewer, explanation.id, 'resolve', 'Replication protocol reviewed')
    assert explanation.state == 'verified'


async def test_young_replication_accounts_cannot_verify():
    repo = MemoryRepository()
    author = Account(uuid4())
    entry = await EntryService(repo).create_draft(author, EntryCreate(kind='idea', template='everyday',
        title='Try a ventilated container', goal='Store food', approach='Add ventilation', lang='en'), 'entry')
    await EntryService(repo).publish(author, entry.id)
    discussion, why = DiscussionService(repo), ExplanationService(repo)
    comment = await discussion.post(author, entry.id,
        CommentCreate(type='hypothesis', body_md='Air flow may help', lang='en'), 'hypothesis')
    explanation = await why.promote(author, comment.id)
    for i in range(2):
        person = Account(uuid4())
        evidence = await discussion.post(person, entry.id,
            CommentCreate(type='evidence', body_md='Tested', lang='en'), str(i))
        await why.add_evidence(person, explanation.id, evidence.id, 'supports', 'replication')
    with pytest.raises(ValidationFailed):
        await why.transition(Account(uuid4(), trust_score=3), explanation.id, 'verify')
    assert repo.explanations[explanation.id]['view'].state == 'supported'
