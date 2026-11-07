"""Same core behavior on memory and real Postgres; no SQLite substitution.

UNSTUCK_TEST_DATABASE_URL must name a disposable database containing "test".
Every test gets a new schema, applies all migrations, and drops only that schema.
"""
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import os
import json
from pathlib import Path
import shutil
import sys
from uuid import uuid4

import httpx
import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo
from psycopg.types.json import Jsonb
import pytest
import pytest_asyncio

from adapters.memory import MemoryRepository, MemoryTransaction
from adapters.migrations import migrate
from adapters.postgres import PostgresRepository
from domain.errors import Conflict, Forbidden, NotFound, StaleVersion, Unavailable, ValidationFailed
from domain.models import CommentCreate, EntryCreate, EntryPatch, OutcomeReportCreate
from main import create_app
from domain.actor import Account
from services.discussion import DiscussionService
from services.entries import EntryService, LinkService
from services.outcomes import ImpactService, OutcomeService
from services.problems import ProblemService
from services.search import SearchService
from settings import get_settings

MIGRATIONS = Path(__file__).resolve().parents[2] / 'db' / 'migrations'


class Storage:
    def __init__(self, repo, dsn=None):
        self.repo, self.dsn = repo, dsn
        self.pools = [repo]

    async def account(self, **values):
        actor = Account(uuid4(), **values)
        if self.dsn:
            async with self.repo.pool.connection() as conn:
                await conn.execute('''INSERT INTO accounts(id,status,trust_score,is_moderator,created_at)
                    VALUES (%s,%s,%s,%s,%s)''',
                    (actor.id, actor.status, actor.trust_score, actor.is_moderator, actor.created_at))
        return actor

    async def another_process(self, **kwargs):
        if not self.dsn:
            return self.repo
        repo = PostgresRepository(self.dsn, **kwargs)
        await repo.open()
        self.pools.append(repo)
        return repo

    async def diagnostics(self, entry_id):
        if not self.dsn:
            repo = self.repo
            return {'reports': sum(target == entry_id for target, _ in repo.reports),
                    'versions': len(repo.versions[entry_id]),
                    'events': sum(e['id'] == str(entry_id) for e in repo.state_events),
                    'outbox': len(repo.outbox),
                    'last': repo.outbox[-1][1] if repo.outbox else None}
        async with self.repo.pool.connection() as conn:
            row = await (await conn.execute('''SELECT
                (SELECT count(*) FROM outcome_reports WHERE entry_id = %s) AS reports,
                (SELECT count(*) FROM entry_versions WHERE entry_id = %s) AS versions,
                (SELECT count(*) FROM state_events WHERE entity_id = %s) AS events,
                (SELECT count(*) FROM outbox_events) AS outbox''', (entry_id,) * 3)).fetchone()
            last = await (await conn.execute('SELECT payload FROM outbox_events ORDER BY id DESC LIMIT 1')).fetchone()
            return {**row, 'last': last['payload'] if last else None}


@pytest_asyncio.fixture(params=['memory', 'postgres'])
async def storage(request):
    if request.param == 'memory':
        yield Storage(MemoryRepository())
        return
    base = os.environ.get('UNSTUCK_TEST_DATABASE_URL')
    if not base:
        pytest.skip('set UNSTUCK_TEST_DATABASE_URL to run real Postgres contract tests')
    if 'test' not in conninfo_to_dict(base).get('dbname', '').lower():
        pytest.fail('UNSTUCK_TEST_DATABASE_URL must name a disposable test database')
    schema = 'test_' + uuid4().hex
    async with await psycopg.AsyncConnection.connect(base, autocommit=True) as admin:
        # Shared extensions live outside the disposable per-test schema.
        for extension in ('vector', 'citext', 'pg_trgm'):
            await admin.execute(sql.SQL('CREATE EXTENSION IF NOT EXISTS {} WITH SCHEMA public').format(
                sql.Identifier(extension)))
        await admin.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
        dsn = make_conninfo(base, options=f'-c search_path={schema},public')
        state = None
        try:
            await migrate(dsn, MIGRATIONS)
            repo = PostgresRepository(dsn)
            await repo.open()
            state = Storage(repo, dsn)
            yield state
        finally:
            if state:
                for pool in state.pools:
                    await pool.close()
            await admin.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(schema)))


def draft(**changes):
    return EntryCreate(**(dict(kind='experience', template='everyday', title='Store tomatoes longer',
        goal='Reduce food waste', approach='Use a cool shelf', result='Lasted a week',
        outcome='worked', lang='en', topics=['food'], context={'country': 'GH'}) | changes))


async def published(storage, actor=None, **changes):
    actor = actor or await storage.account()
    service = EntryService(storage.repo)
    entry = await service.create_draft(actor, draft(**changes), uuid4().hex)
    return actor, await service.publish(actor, entry.id)


async def test_private_drafts_replay_original_response_and_survive_new_pool(storage):
    author, other = await storage.account(), await storage.account()
    service = EntryService(storage.repo)
    original = await service.create_draft(author, draft(), 'same-key')
    await service.edit(author, original.id, EntryPatch(goal='An edited goal'), 1)
    second = EntryService(await storage.another_process())
    assert await second.create_draft(author, draft(), 'same-key') == original
    with pytest.raises(Conflict):
        await second.create_draft(author, draft(goal='Changed request'), 'same-key')
    assert (await second.create_draft(other, draft(), 'same-key')).id != original.id
    with pytest.raises(NotFound):
        await second.get(original.id)
    with pytest.raises(Forbidden):
        await second.edit(other, original.id, EntryPatch(goal='Take ownership'), 2)
    assert (await second.get(original.id, author)).goal == 'An edited goal'
    assert str(author.id) not in original.model_dump_json()


async def test_versions_publication_validation_and_public_history(storage):
    author = await storage.account()
    entries = EntryService(storage.repo)
    entry = await entries.create_draft(author, draft(approach=''), 'draft')
    before = await storage.diagnostics(entry.id)
    with pytest.raises(ValidationFailed):
        await entries.publish(author, entry.id)
    assert await storage.diagnostics(entry.id) == before
    await entries.edit(author, entry.id, EntryPatch(approach='A useful method'), 1)
    public = await entries.publish(author, entry.id)
    assert public.version == 3
    assert len(await entries.history(entry.id)) == 1
    assert len(await entries.history(entry.id, author)) == 3
    public.title = 'Caller mutated a response'
    assert (await entries.get(entry.id)).title == entry.title
    await entries.edit(author, entry.id, EntryPatch(topics=['health']), 3)
    assert (await entries.get(entry.id, author)).status == 'pending_review'
    assert (await SearchService(storage.repo).search('tomatoes'))['items'] == []
    with pytest.raises(NotFound):
        await entries.get(entry.id)


async def test_concurrent_reports_are_absolute_across_connections(storage):
    author, entry = await published(storage)
    accounts = [await storage.account() for _ in range(100)]
    other = await storage.another_process()
    services = [OutcomeService(storage.repo), OutcomeService(other)]
    report = OutcomeReportCreate(verdict='same_for_me', context={'country': 'GH'})
    await asyncio.gather(*(services[i % 2].report(a, entry.id, report) for i, a in enumerate(accounts)))
    await asyncio.gather(*(services[i % 2].report(accounts[0], entry.id, report) for i in range(12)))
    stats = (await EntryService(other).get(entry.id)).stats
    assert stats.same_count == 100
    state = await storage.diagnostics(entry.id)
    assert state['reports'] == 100
    assert state['last']['same_count'] == 100
    await services[1].report(accounts[0], entry.id, OutcomeReportCreate(verdict='not_for_me'))
    stats = (await EntryService(storage.repo).get(entry.id)).stats
    assert (stats.same_count, stats.not_same_count) == (99, 1)
    with pytest.raises(Forbidden):
        await services[0].report(author, entry.id, report)


async def test_concurrent_edits_have_one_winner(storage):
    author, entry = await published(storage)
    second = EntryService(await storage.another_process())
    results = await asyncio.gather(
        EntryService(storage.repo).edit(author, entry.id, EntryPatch(goal='One new goal'), entry.version),
        second.edit(author, entry.id, EntryPatch(goal='Another new goal'), entry.version),
        return_exceptions=True)
    assert sum(isinstance(value, StaleVersion) for value in results) == 1
    assert (await second.get(entry.id)).version == entry.version + 1


@asynccontextmanager
async def failing_outbox(storage, monkeypatch):
    if not storage.dsn:
        async def fail(*args):
            raise RuntimeError('simulated event storage failure')
        with monkeypatch.context() as patch:
            patch.setattr(MemoryTransaction, 'emit', fail)
            yield
        return
    async with storage.repo.pool.connection() as conn:
        await conn.execute('''CREATE FUNCTION reject_test_event() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'simulated event storage failure' USING ERRCODE = '23514'; END $$''')
        await conn.execute('''CREATE TRIGGER reject_test_event BEFORE INSERT ON outbox_events
            FOR EACH ROW EXECUTE FUNCTION reject_test_event()''')
    try:
        yield
    finally:
        async with storage.repo.pool.connection() as conn:
            await conn.execute('DROP TRIGGER reject_test_event ON outbox_events')
            await conn.execute('DROP FUNCTION reject_test_event()')


async def test_failed_outbox_rolls_back_state_history_and_report_replacement(storage, monkeypatch):
    author, reader = await storage.account(), await storage.account()
    entries = EntryService(storage.repo)
    entry = await entries.create_draft(author, draft(), 'draft')
    before = await storage.diagnostics(entry.id)
    async with failing_outbox(storage, monkeypatch):
        with pytest.raises((RuntimeError, psycopg.errors.CheckViolation)):
            await entries.publish(author, entry.id)
    assert (await entries.get(entry.id, author)).status == 'draft'
    assert await storage.diagnostics(entry.id) == before
    await entries.publish(author, entry.id)
    outcomes = OutcomeService(storage.repo)
    await outcomes.report(reader, entry.id, OutcomeReportCreate(verdict='same_for_me'))
    before = await storage.diagnostics(entry.id)
    async with failing_outbox(storage, monkeypatch):
        with pytest.raises((RuntimeError, psycopg.errors.CheckViolation)):
            await outcomes.report(reader, entry.id, OutcomeReportCreate(verdict='not_for_me'))
    assert await storage.diagnostics(entry.id) == before
    counts = (await entries.get(entry.id)).stats
    assert (counts.same_count, counts.not_same_count) == (1, 0)


async def test_problem_answer_resolution_impact_and_operation_scoped_retries(storage):
    author, entry = await published(storage, kind='problem', outcome=None)
    reader = await storage.account()
    discussion = DiscussionService(storage.repo)
    # A failed first attempt must not leave a reservation blocking a corrected retry.
    with pytest.raises(ValidationFailed):
        await discussion.post(reader, entry.id,
            CommentCreate(type='fix_tried', body_md='Needs outcome', lang='en'), 'retry')
    answer = await discussion.post(reader, entry.id,
        CommentCreate(type='answer', body_md='<script>unsafe</script>', lang='en'), 'retry')
    assert '<script>' not in answer.body_html
    assert (await EntryService(storage.repo).get(entry.id)).problem_state == 'answered'
    # The same literal key can be used by a different operation.
    await EntryService(storage.repo).create_draft(reader, draft(), 'retry')
    assert (await ProblemService(storage.repo).mark_solved(author, entry.id, 'answer', answer.id)).problem_state == 'solved'
    other = await storage.another_process()
    assert await DiscussionService(other).list(entry.id) == [answer]
    assert (await OutcomeService(other).report(reader, entry.id,
        OutcomeReportCreate(verdict='solved_for_me'))).solved_for_count == 1
    assert (await ImpactService(other).helped(reader, ('entry', entry.id), 'helped')).helped_count == 1
    replacement = await ImpactService(storage.repo).helped(reader, ('entry', entry.id), 'saved', 'Useful note')
    assert (replacement.helped_count, replacement.saved_count) == (0, 1)
    assert await ImpactService(other).my_impact(author) == {'label': 'not enough reports'}
    assert (await ProblemService(other).unmark_solved(author, entry.id, 'The fix failed later')).problem_state == 'answered'


async def test_concurrent_graph_links_cannot_create_a_cycle(storage):
    pairs = [await published(storage) for _ in range(4)]
    services = [LinkService(storage.repo), LinkService(await storage.another_process())]
    results = await asyncio.gather(*(services[i % 2].link(author, entry.id, pairs[(i + 1) % 4][1].id,
        'next_attempt', 'One change') for i, (author, entry) in enumerate(pairs)), return_exceptions=True)
    assert sum(isinstance(value, Conflict) for value in results) == 1
    assert all(value is None or isinstance(value, Conflict) for value in results)
    for _, entry in pairs:
        chain = await services[0].chain(entry.id)
        assert len({step.entry_id for step in chain}) == len(chain)


async def test_keyset_feed_does_not_repeat_entries_when_new_content_arrives(storage):
    originals = [entry.id for _, entry in [await published(storage) for _ in range(6)]]
    search = SearchService(storage.repo)
    first = await search.search('', limit=2)
    assert first['next_cursor']
    _, new = await published(storage)
    ids = [entry.id for entry in first['items']]
    cursor = first['next_cursor']
    while cursor:
        page = await search.search('', cursor=cursor, limit=2)
        ids.extend(entry.id for entry in page['items'])
        cursor = page['next_cursor']
    assert len(ids) == len(set(ids)) == 6
    assert set(ids) == set(originals) and new.id not in ids
    with pytest.raises(ValidationFailed):
        await search.search('a changed query', cursor=first['next_cursor'])
    for cursor in ('-1', 'garbage', 'x' * 1025):
        with pytest.raises(ValidationFailed):
            await search.search('', cursor=cursor)


async def test_search_filters_visibility_and_literal_query_characters(storage):
    author = await storage.account()
    await EntryService(storage.repo).create_draft(author, draft(), 'private')
    await published(storage, topics=['health'])
    _, match = await published(storage, topics=['food'])
    await published(storage, topics=['software'])
    search = SearchService(storage.repo)
    result = await search.search('tomatoes', {'topic': 'food'}, limit=1)
    assert [row.id for row in result['items']] == [match.id]
    assert result['next_cursor'] is None
    assert (await search.search("%' OR 1=1 --"))['items'] == []
    assert (await search.search('tomatoes', viewer_ctx={'country': 'GH'}))['items']


async def test_problem_sweep_is_bounded_and_reactivated_by_an_answer(storage):
    _, old = await published(storage, kind='problem', outcome=None)
    _, fresh = await published(storage, kind='problem', outcome=None)
    now = datetime.now(timezone.utc)
    reader = await storage.account()
    async with storage.repo.transaction() as tx:
        await tx.load_entry(old.id, lock=True)
        await tx.touch(old.id, now - timedelta(days=40))
    other = await storage.another_process()
    batches = await asyncio.gather(ProblemService(storage.repo).sweep(now), ProblemService(other).sweep(now))
    assert [entry_id for batch in batches for entry_id in batch] == [old.id]
    assert (await EntryService(other).get(fresh.id)).problem_state == 'open'
    await DiscussionService(other).post(reader, old.id,
        CommentCreate(type='answer', body_md='A new answer', lang='en'), 'answer')
    assert (await EntryService(storage.repo).get(old.id)).problem_state == 'answered'


@pytest.mark.parametrize('storage', ['postgres'], indirect=True)
async def test_database_sessions_expire_revoke_and_do_not_expose_account_ids(storage):
    author = await storage.account()
    entry = await EntryService(storage.repo).create_draft(author, draft(), 'draft')
    token = 'session-' + uuid4().hex + uuid4().hex
    digest = sha256(token.encode()).digest()
    async with storage.repo.pool.connection() as conn:
        await conn.execute('INSERT INTO sessions(id_hash,account_id,expires_at) VALUES (%s,%s,now()+interval \'1 hour\')',
                           (digest, author.id))
    app = create_app(storage.repo)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='http://test') as client:
        assert (await client.get(f'/api/v1/entries/{entry.id}')).status_code == 404
        client.cookies.set('session', token)
        response = await client.get(f'/api/v1/entries/{entry.id}')
        assert response.status_code == 200, response.text
        assert str(author.id) not in response.text and token not in response.text
        # Persistent mode must never use the legacy process-local services.
        assert (await client.get('/api/v1/pages/example')).status_code == 501
        assert (await client.get('/readyz')).status_code == 200
        async with storage.repo.pool.connection() as conn:
            await conn.execute('UPDATE sessions SET expires_at=now()-interval \'1 second\' WHERE id_hash=%s', (digest,))
        assert (await client.get(f'/api/v1/entries/{entry.id}')).status_code == 404
        assert (await client.post('/api/v1/entries', json=draft().model_dump(mode='json'),
                                  headers={'Idempotency-Key': 'expired'})).status_code == 403
        async with storage.repo.pool.connection() as conn:
            await conn.execute('UPDATE sessions SET expires_at=now()+interval \'1 hour\',revoked_at=now() WHERE id_hash=%s',
                               (digest,))
        assert await storage.repo.session_actor(token) is None
        async with storage.repo.pool.connection() as conn:
            await conn.execute('UPDATE sessions SET revoked_at=NULL WHERE id_hash=%s', (digest,))
            await conn.execute("UPDATE accounts SET status='suspended' WHERE id=%s", (author.id,))
        assert await storage.repo.session_actor(token) is None
        await storage.repo.close()
        assert (await client.get('/readyz')).status_code == 503
        response = await client.get('/api/v1/feed')
        assert response.status_code == 503 and response.headers['retry-after'] == '1'
        assert response.json()['code'] == 'unavailable' and 'postgresql' not in response.text


@pytest.mark.parametrize('storage', ['postgres'], indirect=True)
async def test_database_rechecks_account_state_inside_write_transaction(storage):
    author = await storage.account()
    async with storage.repo.pool.connection() as conn:
        await conn.execute("UPDATE accounts SET status='suspended' WHERE id=%s", (author.id,))
    # A previously loaded actor cannot authorize writes after suspension.
    with pytest.raises(Forbidden):
        await EntryService(storage.repo).create_draft(author, draft(), 'stale-actor')


@pytest.mark.parametrize('storage', ['postgres'], indirect=True)
async def test_independent_entries_do_not_share_a_global_write_lock(storage):
    _, one = await published(storage)
    _, two = await published(storage)
    reader = await storage.account()
    other = await storage.another_process()
    async with storage.repo.transaction() as tx:
        await tx.load_entry(one.id, lock=True)
        stats = await asyncio.wait_for(OutcomeService(other).report(reader, two.id,
            OutcomeReportCreate(verdict='same_for_me')), timeout=1)
        assert stats.same_count == 1


@pytest.mark.parametrize('storage', ['postgres'], indirect=True)
async def test_read_transactions_hold_a_consistent_snapshot_without_blocking_writes(storage):
    author, entry = await published(storage)
    other = await storage.another_process()
    async with storage.repo.transaction(readonly=True) as tx:
        before = (await tx.load_entry(entry.id)).view
        await EntryService(other).edit(author, entry.id, EntryPatch(goal='A newer goal'), entry.version)
        assert (await tx.load_entry(entry.id)).view == before
    assert (await EntryService(storage.repo).get(entry.id)).goal == 'A newer goal'


@pytest.mark.parametrize('storage', ['postgres'], indirect=True)
async def test_bounded_pool_returns_a_retryable_error_instead_of_waiting_forever(storage):
    bounded = await storage.another_process(min_size=1, max_size=1, timeout=.05, max_waiting=1)
    async with bounded.pool.connection():
        with pytest.raises(Unavailable) as error:
            async with bounded.transaction():
                pytest.fail('the only connection should remain occupied')
        assert error.value.retry_after == 1
        assert 'postgresql' not in error.value.detail


@pytest.mark.parametrize('storage', ['postgres'], indirect=True)
async def test_migrations_are_repeatable_and_reject_modified_applied_files(storage, tmp_path):
    assert await migrate(storage.dsn, MIGRATIONS) == []
    copy = tmp_path / 'migrations'
    shutil.copytree(MIGRATIONS, copy)
    path = copy / '0002_core_transactions.sql'
    path.write_text(path.read_text() + '\n-- unexpected drift\n')
    with pytest.raises(RuntimeError, match='applied migration was modified'):
        await migrate(storage.dsn, copy)


@pytest.mark.parametrize('storage', ['postgres'], indirect=True)
async def test_startup_refuses_an_unmigrated_schema(storage):
    schema = 'test_unmigrated_' + uuid4().hex
    async with storage.repo.pool.connection() as conn:
        await conn.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
        broken = PostgresRepository(make_conninfo(storage.dsn, options=f'-c search_path={schema},public'))
        try:
            with pytest.raises(RuntimeError, match='migrations must be applied'):
                await broken.open()
            assert broken.pool.closed
        finally:
            await broken.close()
            await conn.execute(sql.SQL('DROP SCHEMA {}').format(sql.Identifier(schema)))


@pytest.mark.parametrize('storage', ['postgres'], indirect=True)
async def test_a_fresh_process_reads_committed_data_and_crash_rolls_back_partial_writes(storage):
    _, entry = await published(storage)
    before = await storage.diagnostics(entry.id)
    # Only disposable test credentials are passed in the child environment.
    env = {**os.environ, 'UNSTUCK_TEST_CONNECTION': storage.dsn, 'UNSTUCK_TEST_ENTRY': str(entry.id)}
    script = '''
import os, psycopg
with psycopg.connect(os.environ['UNSTUCK_TEST_CONNECTION']) as conn:
    row = conn.execute("SELECT status FROM entries WHERE id=%s", (os.environ['UNSTUCK_TEST_ENTRY'],)).fetchone()
    assert row[0] == 'published'
    conn.execute("UPDATE entries SET status='deleted' WHERE id=%s", (os.environ['UNSTUCK_TEST_ENTRY'],))
    conn.execute("INSERT INTO outbox_events(stream,payload) VALUES ('events:internal','{}')")
    os._exit(13)
'''
    child = await asyncio.create_subprocess_exec(sys.executable, '-c', script, env=env,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    stdout, stderr = await asyncio.wait_for(child.communicate(), timeout=10)
    assert child.returncode == 13, stderr.decode()
    assert (await EntryService(await storage.another_process()).get(entry.id)).status == 'published'
    assert await storage.diagnostics(entry.id) == before


@pytest.mark.parametrize('storage', ['postgres'], indirect=True)
async def test_persistent_read_suppresses_private_or_invalid_media_and_keeps_written_content(storage):
    author, entry = await published(storage)
    fixture = json.loads((MIGRATIONS.parents[1] / 'contracts/media/fixtures/image-v1.json').read_text())
    media_id = fixture['id']
    async with storage.repo.pool.connection() as conn:
        await conn.execute('''INSERT INTO media(id,entry_id,uploader_id,kind,status,review_status,
            alt_text,original_key,variants,public_manifest)
            VALUES (%s,%s,%s,'image','ready','pending_review','Private description','orig/private',%s,%s)''',
            (media_id, entry.id, author.id, Jsonb({'original': 'orig/private'}), Jsonb(fixture)))
    private = await EntryService(storage.repo).get(entry.id)
    assert private.media[0].manifest is None and private.media[0].alt_text is None
    assert 'orig/private' not in private.model_dump_json()
    async with storage.repo.pool.connection() as conn:
        await conn.execute("UPDATE media SET review_status='approved',public_manifest=%s WHERE id=%s",
                           (Jsonb({'v': 999, 'id': media_id}), media_id))
    broken = await EntryService(storage.repo).get(entry.id)
    assert broken.title == entry.title and broken.media[0].manifest is None
    async with storage.repo.pool.connection() as conn:
        await conn.execute('UPDATE media SET public_manifest=%s WHERE id=%s', (Jsonb(fixture), media_id))
    approved = await EntryService(storage.repo).get(entry.id)
    assert approved.media[0].manifest.root.id.hex == media_id.replace('-', '')


@pytest.mark.parametrize('storage', ['postgres'], indirect=True)
async def test_database_topic_classification_cannot_be_downgraded_by_a_topic_edit(storage):
    author = await storage.account()
    entries = EntryService(storage.repo)
    pending = await entries.create_draft(author, draft(topics=['custom-risk']), 'risk')
    async with storage.repo.pool.connection() as conn:
        await conn.execute("UPDATE topics SET high_stakes=true WHERE slug='custom-risk'")
    assert (await entries.publish(author, pending.id)).status == 'pending_review'
    public = await entries.create_draft(author, draft(), 'public')
    public = await entries.publish(author, public.id)
    edited = await entries.edit(author, public.id, EntryPatch(topics=['custom-risk']), public.version)
    assert edited.status == 'pending_review' and edited.high_stakes
    with pytest.raises(NotFound):
        await entries.get(public.id)


@pytest.mark.parametrize('storage', ['postgres'], indirect=True)
async def test_configured_app_owns_its_pool_and_serves_the_persistent_write_path(storage, monkeypatch):
    author = await storage.account()
    token = uuid4().hex + uuid4().hex
    async with storage.repo.pool.connection() as conn:
        await conn.execute('INSERT INTO sessions(id_hash,account_id,expires_at) VALUES (%s,%s,now()+interval \'1 hour\')',
                           (sha256(token.encode()).digest(), author.id))
    monkeypatch.setattr(get_settings(), 'DATABASE_BACKEND', 'postgres')
    monkeypatch.setattr(get_settings(), 'DATABASE_URL', storage.dsn)
    app = create_app()
    assert isinstance(app.state.repo, PostgresRepository)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='http://test') as client:
            assert (await client.get('/readyz')).status_code == 200
            client.cookies.set('session', token)
            created = await client.post('/api/v1/entries', json=draft().model_dump(mode='json'),
                                        headers={'Idempotency-Key': 'http-create'})
            assert created.status_code == 201, created.text
            entry_id = created.json()['id']
            assert (await client.post(f'/api/v1/entries/{entry_id}/publish')).status_code == 200
            client.cookies.clear()
            response = await client.get(f'/api/v1/entries/{entry_id}')
            assert response.status_code == 200 and str(author.id) not in response.text
    assert app.state.repo.pool.closed
