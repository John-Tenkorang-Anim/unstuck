"""Executable privacy, concurrency, and knowledge-loop acceptance tests."""
import asyncio
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from adapters.memory import MemoryRepository
from domain.errors import Conflict, Forbidden, NotFound, StaleVersion, ValidationFailed
from domain.models import EntryCreate, EntryPatch, OutcomeReportCreate
from main import create_app
from domain.actor import Account
from services.entries import EntryService
from services.outcomes import OutcomeService


@pytest.fixture
def core():
    repo = MemoryRepository()
    return repo, EntryService(repo), Account(uuid4())


def data(**overrides):
    return EntryCreate(**(dict(kind='experience', template='everyday', title='Store tomatoes longer',
        goal='Reduce food waste', approach='Use a cool shelf', result='Lasted a week',
        outcome='worked', lang='en') | overrides))


async def test_private_drafts_idempotency_and_versions(core):
    repo, service, author = core
    draft = await service.create_draft(author, data(), 'create')
    assert (await service.create_draft(author, data(), 'create')).id == draft.id
    with pytest.raises(Conflict):
        await service.create_draft(author, data(title='Another title'), 'create')
    with pytest.raises(NotFound):
        await service.get(draft.id)
    with pytest.raises(Forbidden):
        await service.edit(Account(uuid4()), draft.id, EntryPatch(goal='steal'), 1)
    updated = await service.edit(author, draft.id, EntryPatch(goal='Keep food fresh'), 1)
    with pytest.raises(StaleVersion):
        await service.edit(author, draft.id, EntryPatch(goal='overwrite'), 1)
    published = await service.publish(author, draft.id)
    assert published.version == 3
    assert len(await service.history(draft.id)) == 1
    assert len(await service.history(draft.id, author)) == 3
    assert len(repo.state_events) == 1
    assert repo.outbox[-1][1]['worked_count'] == 0
    assert str(author.id) not in published.model_dump_json()
    updated.title = 'Mutated copy'
    assert (await service.get(draft.id)).title != updated.title


async def test_publish_validation_is_atomic(core):
    repo, service, author = core
    draft = await service.create_draft(author, data(approach=''), 'create')
    with pytest.raises(ValidationFailed):
        await service.publish(author, draft.id)
    assert repo.entries[draft.id].status == 'draft'
    assert repo.state_events == []
    with pytest.raises(ValidationFailed):
        await service.edit(author, draft.id, EntryPatch(context={'unknown': 'x'}), 1)
    assert repo.entries[draft.id].version == 1


async def test_T05_T06_concurrent_reports_and_absolute_events(core):
    repo, service, author = core
    entry = await service.create_draft(author, data(), 'create')
    await service.publish(author, entry.id)
    outcomes = OutcomeService(repo)
    report = OutcomeReportCreate(verdict='same_for_me', context={'country': 'GH'})
    accounts = [Account(uuid4()) for _ in range(100)]
    await asyncio.gather(*(outcomes.report(a, entry.id, report) for a in accounts))
    await asyncio.gather(*(outcomes.report(accounts[0], entry.id, report) for _ in range(10)))
    assert len(repo.reports) == 100
    assert repo.entries[entry.id].stats.same_count == 100
    assert repo.outbox[-1][1]['same_count'] == 100
    changed = OutcomeReportCreate(verdict='not_for_me')
    await outcomes.report(accounts[0], entry.id, changed)
    assert repo.entries[entry.id].stats.same_count == 99
    assert repo.entries[entry.id].stats.not_same_count == 1
    with pytest.raises(Forbidden):
        await outcomes.report(author, entry.id, report)


async def test_T21_aliases_and_T22_context_suppression(core):
    repo, service, author = core
    one = await service.create_draft(author, data(), 'one')
    two = await service.create_draft(author, data(), 'two')
    assert one.author.alias != two.author.alias
    await service.publish(author, one.id)
    await OutcomeService(repo).report(Account(uuid4()), one.id,
        OutcomeReportCreate(verdict='same_for_me', context={'country': 'GH'}))
    assert (await service.compare_context(one.id))['country']['GH'] == {'label': 'few reports'}


def test_T70_problem_answer_solve_report_impact():
    repo = MemoryRepository()
    app = create_app(repo)
    author, reader = Account(uuid4()), Account(uuid4())
    repo.sessions.update({'author': author, 'reader': reader})
    with TestClient(app) as client:
        client.cookies.set('session', 'author')
        problem = dict(kind='problem', template='everyday', title='How to store tomatoes?',
                       goal='Reduce waste', approach='Tried a cupboard', lang='en')
        response = client.post('/api/v1/entries', json=problem, headers={'Idempotency-Key': 'problem'})
        assert response.status_code == 201, response.text
        entry_id = response.json()['id']
        assert client.post(f'/api/v1/entries/{entry_id}/publish').status_code == 200
        client.cookies.set('session', 'reader')
        response = client.post(f'/api/v1/entries/{entry_id}/comments',
            json={'type': 'answer', 'body_md': '<script>alert(1)</script>', 'lang': 'en'},
            headers={'Idempotency-Key': 'answer'})
        assert response.status_code == 201, response.text
        answer = response.json()
        assert '<script>' not in answer['body_html']
        client.cookies.set('session', 'author')
        response = client.post(f'/api/v1/entries/{entry_id}/solved',
                               json={'by': 'answer', 'target_id': answer['id']})
        assert response.json()['problem_state'] == 'solved'
        client.cookies.set('session', 'reader')
        assert client.post(f'/api/v1/entries/{entry_id}/reports', json={'verdict': 'solved_for_me'}).json()['solved_for_count'] == 1
        assert client.post(f'/api/v1/entries/{entry_id}/helped', json={'kind': 'helped'}).json()['helped_count'] == 1
        client.cookies.set('session', 'author')
        assert client.get('/api/v1/me/impact').json() == {'label': 'not enough reports'}
        client.cookies.clear()
        payload = client.get('/api/v1/feed').text
        assert str(author.id) not in payload and str(reader.id) not in payload
        assert client.post('/api/v1/entries', json=problem, headers={'Idempotency-Key': 'bad'}).status_code == 403


async def test_T50_search_visibility_and_high_stakes_review(core):
    from services.search import SearchService
    repo, entries, author = core
    published = await entries.create_draft(author, data(), 'public')
    await entries.publish(author, published.id)
    draft = await entries.create_draft(author, data(), 'private')
    sensitive = await entries.create_draft(author, data(topics=['health']), 'sensitive')
    assert (await entries.publish(author, sensitive.id)).status == 'pending_review'
    results = await SearchService(repo).search('tomatoes')
    assert [item.id for item in results['items']] == [published.id]
    with pytest.raises(NotFound):
        await entries.get(sensitive.id)
    await entries.edit(author, published.id, EntryPatch(topics=['health']), 2)
    assert (await SearchService(repo).search('tomatoes'))['items'] == []
    assert (await entries.get(draft.id, author)).status == 'draft'
