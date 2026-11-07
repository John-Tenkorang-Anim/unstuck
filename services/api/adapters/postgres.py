"""Postgres implementation of the core transaction boundary.

Each operation borrows one bounded pooled connection. Writes lock their entry
aggregate; independent entries do not share a process-wide or database-wide lock.
"""
from contextlib import asynccontextmanager
from collections import defaultdict
from hashlib import sha256
from html import escape
import secrets

import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool, PoolClosed, PoolTimeout, TooManyRequests
from pydantic import ValidationError

from adapters.migrations import REQUIRED_SCHEMA
from adapters.repository import EntryRecord, request_digest
from domain.errors import Conflict, Forbidden, NotFound, Unavailable
from domain.pagination import SearchPosition
from domain.media import PublicMediaManifest
from domain.models import (
    CommentCreate, CommentView, EntryStats, EntryView, LinkView, MediaView,
    OutcomeReportCreate, PersonRef, TopicRef,
)
from domain.actor import Account

GRAPH_LOCK = 751824246508344200
ENTRY_FIELDS = ('kind', 'template', 'status', 'outcome', 'problem_state', 'title',
                'goal', 'approach', 'result', 'why_text', 'advice', 'type_fields',
                'lang', 'license', 'why_status', 'high_stakes', 'version', 'published_at')
STATS_FIELDS = tuple(EntryStats.model_fields)


def authenticated(row):
    return Account(row['id'], row['status'], row['trust_score'],
                   row['is_moderator'], row['created_at'])


class PostgresRepository:
    # These workflows must be migrated explicitly; never fall back to memory.
    supports_extended_workflows = False

    def __init__(self, dsn, *, min_size=1, max_size=8, timeout=5, max_waiting=64):
        options = conninfo_to_dict(dsn).get('options', '')
        self.pool = AsyncConnectionPool(
            dsn, open=False, min_size=min_size, max_size=max_size,
            timeout=timeout, max_waiting=max_waiting,
            kwargs={'autocommit': True, 'row_factory': dict_row, 'connect_timeout': 5,
                    'options': options + ' -c statement_timeout=5000 -c lock_timeout=3000 '
                               '-c idle_in_transaction_session_timeout=10000'},
            check=AsyncConnectionPool.check_connection,
        )

    async def open(self):
        try:
            await self.pool.open(wait=True, timeout=10)
            async with self.pool.connection() as conn:
                location = await (await conn.execute('''SELECT current_schema() AS schema,
                    to_regclass(format('%I.schema_migrations', current_schema())) AS migrations''')).fetchone()
                if location['migrations'] is None:
                    raise RuntimeError('database migrations must be applied before startup')
                row = await (await conn.execute(sql.SQL(
                    'SELECT name FROM {} ORDER BY name DESC LIMIT 1').format(
                        sql.Identifier(location['schema'], 'schema_migrations')))).fetchone()
                if not row or row['name'] != REQUIRED_SCHEMA:
                    raise RuntimeError('database migrations must be applied before startup')
        except BaseException:
            await self.pool.close()
            raise

    async def close(self):
        await self.pool.close()

    async def ready(self):
        try:
            async with self.pool.connection(timeout=1) as conn:
                await conn.execute('SELECT 1')
            return True
        except (psycopg.Error, PoolClosed, PoolTimeout, TooManyRequests):
            return False

    @asynccontextmanager
    async def transaction(self, *, readonly=False):
        try:
            async with self.pool.connection() as conn:
                async with conn.transaction():
                    if readonly:
                        await conn.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
                    yield PostgresTransaction(conn, readonly=readonly)
        except (PoolClosed, PoolTimeout, TooManyRequests, psycopg.OperationalError,
                psycopg.errors.QueryCanceled, psycopg.errors.LockNotAvailable) as exc:
            # Do not expose SQL, connection strings, private IDs or parameters.
            raise Unavailable('storage is temporarily unavailable; retry the request', retry_after=1) from exc

    async def session_actor(self, token):
        if not token or not 32 <= len(token) <= 256:
            return None
        async with self.transaction(readonly=True) as tx:
            row = await (await tx.conn.execute('''SELECT a.* FROM sessions s
                JOIN accounts a ON a.id = s.account_id
                WHERE s.id_hash = %s AND s.revoked_at IS NULL
                  AND s.expires_at > clock_timestamp() AND a.status = 'active' ''',
                (sha256(token.encode()).digest(),))).fetchone()
            return authenticated(row) if row else None


class PostgresTransaction:
    def __init__(self, conn, *, readonly=False):
        self.conn = conn
        self.readonly = readonly

    async def check_actor(self, actor):
        if actor is None:
            raise Forbidden('an active session is required')
        query = 'SELECT * FROM accounts WHERE id = %s'
        if not self.readonly:
            query += ' FOR SHARE'
        row = await (await self.conn.execute(query, (actor.id,))).fetchone()
        if not row or row['status'] != 'active':
            raise Forbidden('an active session is required')
        return authenticated(row)

    async def load_entry(self, entry_id, actor=None, *, own=False, lock=False):
        query = 'SELECT * FROM entries WHERE id = %s'
        if lock:
            query += ' FOR UPDATE'
        row = await (await self.conn.execute(query, (entry_id,))).fetchone()
        if not row or row['status'] == 'deleted':
            raise NotFound('entry not found')
        owner = actor is not None and row['author_id'] == actor.id
        if own:
            if actor is None or actor.status != 'active' or not owner:
                raise Forbidden('only the author may change this entry')
        elif row['status'] != 'published' and not owner:
            raise NotFound('entry not found')
        return EntryRecord(await self._view(row), row['author_id'], row['last_activity_at'])

    async def _view(self, row):
        return (await self._views([row]))[0]

    async def _views(self, rows):
        if not rows:
            return []
        ids = [row['id'] for row in rows]
        stats = {row['entry_id']: row for row in await (await self.conn.execute(
            'SELECT * FROM entry_stats WHERE entry_id = ANY(%s)', (ids,))).fetchall()}
        aliases = {row['entry_id']: row['alias'] for row in await (await self.conn.execute('''
            SELECT a.entry_id, a.alias FROM entry_aliases a JOIN entries e ON e.id = a.entry_id
            AND e.author_id = a.account_id WHERE a.entry_id = ANY(%s)''', (ids,))).fetchall()}
        contexts = await (await self.conn.execute(
            'SELECT entry_id, key, value FROM entry_context WHERE entry_id = ANY(%s)', (ids,))).fetchall()
        topics = await (await self.conn.execute('''SELECT et.entry_id, t.slug, t.names, t.high_stakes
            FROM entry_topics et JOIN topics t ON t.id = et.topic_id
            WHERE et.entry_id = ANY(%s) ORDER BY t.slug''', (ids,))).fetchall()
        links = await (await self.conn.execute('''SELECT from_id, to_id, rel, note FROM entry_links
            WHERE from_id = ANY(%s) ORDER BY created_at, to_id, rel''', (ids,))).fetchall()
        media = await (await self.conn.execute('''SELECT entry_id, id, kind, status, review_status,
            alt_text, public_manifest FROM media WHERE entry_id = ANY(%s) ORDER BY created_at, id''',
            (ids,))).fetchall()
        context_map, topic_map, link_map, media_map = (defaultdict(list) for _ in range(4))
        for item in contexts:
            context_map[item['entry_id']].append(item)
        for item in topics:
            topic_map[item['entry_id']].append(item)
        for item in links:
            link_map[item['from_id']].append(LinkView(to_id=item['to_id'], rel=item['rel'], note=item['note']))
        for item in media:
            approved = item['status'] == 'ready' and item['review_status'] == 'approved'
            manifest = None
            if approved and item['public_manifest'] is not None:
                try:
                    candidate = PublicMediaManifest.model_validate(item['public_manifest'])
                    if candidate.root.id == item['id'] and candidate.root.kind == item['kind']:
                        manifest = candidate
                except ValidationError:
                    pass  # A broken attachment must not suppress the written entry.
            media_map[item['entry_id']].append(MediaView(
                id=item['id'], kind=item['kind'], status=item['status'],
                review_status=item['review_status'],
                alt_text=item['alt_text'] if approved else None,
                manifest=manifest))
        result = []
        for row in rows:
            entry_id = row['id']
            if entry_id not in stats or entry_id not in aliases:
                raise RuntimeError('entry stats or author alias invariant is broken')
            result.append(EntryView(id=entry_id, **{key: row[key] for key in ENTRY_FIELDS},
                author=PersonRef(alias=aliases[entry_id], is_author=True),
                context={c['key']: c['value'] for c in context_map[entry_id]},
                topics=[TopicRef(slug=t['slug'], name=t['names'].get(row['lang'], t['names'].get('en', t['slug'])),
                                 high_stakes=t['high_stakes']) for t in topic_map[entry_id]],
                stats=EntryStats(**{key: stats[entry_id][key] for key in STATS_FIELDS}),
                media=media_map[entry_id], links=link_map[entry_id]))
        return result

    async def insert_entry(self, entry, author_id):
        values = entry.model_dump(mode='json')
        fields = ('id', 'author_id', *ENTRY_FIELDS)
        data = [entry.id, author_id, *[Jsonb(values[key]) if key == 'type_fields' else values[key]
                                     for key in ENTRY_FIELDS]]
        await self.conn.execute(sql.SQL('INSERT INTO entries ({}) VALUES ({})').format(
            sql.SQL(',').join(map(sql.Identifier, fields)),
            sql.SQL(',').join(sql.Placeholder() for _ in fields)), data)
        await self.conn.execute('INSERT INTO entry_stats(entry_id) VALUES (%s)', (entry.id,))
        await self.conn.execute('''INSERT INTO entry_aliases(entry_id, account_id, alias)
            VALUES (%s, %s, %s)''', (entry.id, author_id, entry.author.alias))
        await self._content(entry)

    async def save_entry(self, entry, *, content=False):
        values = entry.model_dump(mode='json')
        fields = ENTRY_FIELDS if content else (
            'status', 'problem_state', 'why_status', 'high_stakes', 'version', 'published_at')
        data = [Jsonb(values[key]) if key == 'type_fields' else values[key] for key in fields]
        await self.conn.execute(sql.SQL('UPDATE entries SET {} WHERE id = %s').format(
            sql.SQL(',').join(sql.SQL('{} = %s').format(sql.Identifier(key)) for key in fields)),
            [*data, entry.id])
        await self.conn.execute(sql.SQL('UPDATE entry_stats SET {} WHERE entry_id = %s').format(
            sql.SQL(',').join(sql.SQL('{} = %s').format(sql.Identifier(key)) for key in STATS_FIELDS)),
            [*entry.stats.model_dump().values(), entry.id])
        if content:
            await self._content(entry)

    async def _content(self, entry):
        await self.conn.execute('DELETE FROM entry_context WHERE entry_id = %s', (entry.id,))
        for key, value in entry.context.items():
            await self.conn.execute('INSERT INTO entry_context(entry_id, key, value) VALUES (%s,%s,%s)',
                                   (entry.id, key, value))
        await self.conn.execute('DELETE FROM entry_topics WHERE entry_id = %s', (entry.id,))
        for topic in sorted(entry.topics, key=lambda t: t.slug):
            await self.conn.execute('''INSERT INTO topics(slug, names, high_stakes) VALUES (%s,%s,%s)
                ON CONFLICT (slug) DO NOTHING''',
                (topic.slug, Jsonb({'en': topic.name}), topic.high_stakes))
            await self.conn.execute('''INSERT INTO entry_topics(entry_id, topic_id)
                SELECT %s, id FROM topics WHERE slug = %s ON CONFLICT DO NOTHING''',
                (entry.id, topic.slug))

    async def snapshot(self, entry):
        await self.conn.execute('INSERT INTO entry_versions(entry_id, version, snapshot) VALUES (%s,%s,%s)',
                               (entry.id, entry.version, Jsonb(entry.model_dump(mode='json'))))

    async def history(self, entry_id, *, owner):
        rows = await (await self.conn.execute('''SELECT snapshot FROM entry_versions
            WHERE entry_id = %s AND (%s OR snapshot->>'status' = 'published') ORDER BY version''',
            (entry_id, owner))).fetchall()
        return [EntryView.model_validate(row['snapshot']) for row in rows]

    async def event(self, entity, entity_id, previous, destination, actor=None, note=None):
        await self.conn.execute('''INSERT INTO state_events
            (entity, entity_id, from_state, to_state, actor_id, note) VALUES (%s,%s,%s,%s,%s,%s)''',
            (entity, entity_id, previous, destination, actor.id if actor else None, note))

    async def emit(self, entry):
        stream = f'live:entry:{entry.id}' if entry.status in ('published', 'deleted', 'hidden') else 'events:internal'
        payload = {'v': 1, 'name': 'stats.updated', **entry.stats.model_dump()}
        await self.conn.execute('INSERT INTO outbox_events(stream, payload) VALUES (%s,%s)',
                               (stream, Jsonb(payload)))

    async def replay(self, account_id, operation, key, payload):
        digest = request_digest(payload)
        # Reserving first serializes concurrent attempts, including the first use.
        # The reservation rolls back together with the mutation on every failure.
        await self.conn.execute('''INSERT INTO idempotency_keys
            (account_id, operation, key, request_hash, response) VALUES (%s,%s,%s,%s,'{}')
            ON CONFLICT DO NOTHING''', (account_id, operation, key, digest))
        row = await (await self.conn.execute('''SELECT request_hash, response,
            created_at <= now() - interval '24 hours' AS expired
            FROM idempotency_keys WHERE account_id = %s AND operation = %s AND key = %s
            FOR UPDATE''', (account_id, operation, key))).fetchone()
        if row['expired']:
            await self.conn.execute('''UPDATE idempotency_keys
                SET request_hash = %s, response = '{}', created_at = now()
                WHERE account_id = %s AND operation = %s AND key = %s''',
                (digest, account_id, operation, key))
            return None
        if row['request_hash'] != digest:
            raise Conflict('idempotency key was used with a different request')
        return row['response'] or None

    async def remember(self, account_id, operation, key, response):
        await self.conn.execute('''UPDATE idempotency_keys SET response = %s
            WHERE account_id = %s AND operation = %s AND key = %s''',
            (Jsonb(response), account_id, operation, key))

    async def person_ref(self, entry_id, account_id):
        await self.conn.execute('''INSERT INTO entry_aliases(entry_id, account_id, alias)
            VALUES (%s,%s,%s) ON CONFLICT (entry_id, account_id) DO NOTHING''',
            (entry_id, account_id, 'reader-' + secrets.token_hex(8)))
        row = await (await self.conn.execute('''SELECT a.alias, e.author_id = a.account_id AS is_author
            FROM entry_aliases a JOIN entries e ON e.id = a.entry_id
            WHERE a.entry_id = %s AND a.account_id = %s''', (entry_id, account_id))).fetchone()
        return PersonRef(**row)

    async def topic_refs(self, slugs, lang):
        from services.safety import HIGH_STAKES_TOPICS
        rows = await (await self.conn.execute(
            'SELECT slug, names, high_stakes FROM topics WHERE slug = ANY(%s)', (slugs,))).fetchall()
        known = {row['slug']: row for row in rows}
        return [TopicRef(slug=slug,
            name=known[slug]['names'].get(lang, known[slug]['names'].get('en', slug)) if slug in known else slug,
            high_stakes=slug in HIGH_STAKES_TOPICS or (slug in known and known[slug]['high_stakes']))
            for slug in dict.fromkeys(slugs)]

    async def get_report(self, entry_id, account_id):
        row = await (await self.conn.execute('''SELECT verdict, context, note FROM outcome_reports
            WHERE entry_id = %s AND account_id = %s''', (entry_id, account_id))).fetchone()
        return OutcomeReportCreate(**row) if row else None

    async def put_report(self, entry_id, account_id, data):
        await self.conn.execute('''INSERT INTO outcome_reports(entry_id, account_id, verdict, context, note)
            VALUES (%s,%s,%s,%s,%s) ON CONFLICT (entry_id, account_id) DO UPDATE
            SET verdict = EXCLUDED.verdict, context = EXCLUDED.context, note = EXCLUDED.note''',
            (entry_id, account_id, data.verdict, Jsonb(data.context), data.note))

    async def reports_for(self, entry_id):
        rows = await (await self.conn.execute('''SELECT verdict, context, note FROM outcome_reports
            WHERE entry_id = %s''', (entry_id,))).fetchall()
        return [OutcomeReportCreate(**row) for row in rows]

    async def get_signal(self, entry_id, account_id):
        row = await (await self.conn.execute('''SELECT kind FROM helped
            WHERE target_type = 'entry' AND target_id = %s AND account_id = %s''',
            (entry_id, account_id))).fetchone()
        return row['kind'] if row else None

    async def put_signal(self, entry_id, account_id, kind, note):
        await self.conn.execute('''INSERT INTO helped(target_type, target_id, account_id, kind, saved_note)
            VALUES ('entry',%s,%s,%s,%s) ON CONFLICT (target_type, target_id, account_id)
            DO UPDATE SET kind = EXCLUDED.kind, saved_note = EXCLUDED.saved_note''',
            (entry_id, account_id, kind, note))

    async def impact(self, author_id):
        row = await (await self.conn.execute('''SELECT count(DISTINCT h.account_id) AS people,
            count(*) FILTER (WHERE h.kind = 'helped') AS helped,
            count(*) FILTER (WHERE h.kind = 'saved') AS saved
            FROM helped h JOIN entries e ON e.id = h.target_id
            WHERE h.target_type = 'entry' AND e.author_id = %s''', (author_id,))).fetchone()
        return row['people'], {'helped': row['helped'], 'saved': row['saved']}

    @staticmethod
    def _comment(row):
        data = CommentCreate(type=row['type'], body_md=row['body_md'], lang=row['lang'],
                             parent_id=row['parent_id'], fix_outcome=row['fix_outcome'])
        view = CommentView(id=row['id'], parent_id=row['parent_id'], type=row['type'], lang=row['lang'],
            body_html='<p>' + escape(row['body_md']).replace('\n', '<br>') + '</p>',
            author=PersonRef(alias=row['alias'], is_author=row['author_id'] == row['entry_author']))
        return {'view': view, 'entry_id': row['entry_id'], 'owner': row['author_id'], 'data': data}

    async def get_comment(self, comment_id):
        row = await (await self.conn.execute('''SELECT c.*, a.alias, e.author_id AS entry_author
            FROM comments c JOIN entry_aliases a ON a.entry_id = c.entry_id AND a.account_id = c.author_id
            JOIN entries e ON e.id = c.entry_id WHERE c.id = %s AND c.status = 'visible' ''',
            (comment_id,))).fetchone()
        return self._comment(row) if row else None

    async def insert_comment(self, record):
        data = record['data']
        await self.conn.execute('''INSERT INTO comments
            (id, entry_id, author_id, parent_id, type, body_md, lang, fix_outcome)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)''',
            (record['view'].id, record['entry_id'], record['owner'], data.parent_id,
             data.type, data.body_md, data.lang, data.fix_outcome))

    async def comments_for(self, entry_id):
        rows = await (await self.conn.execute('''SELECT c.*, a.alias, e.author_id AS entry_author
            FROM comments c JOIN entry_aliases a ON a.entry_id = c.entry_id AND a.account_id = c.author_id
            JOIN entries e ON e.id = c.entry_id WHERE c.entry_id = %s AND c.status = 'visible'
            ORDER BY c.created_at, c.id''', (entry_id,))).fetchall()
        return [self._comment(row)['view'] for row in rows]

    async def touch(self, entry_id, at):
        await self.conn.execute('UPDATE entries SET last_activity_at = %s WHERE id = %s', (at, entry_id))

    async def put_resolution(self, entry_id, by, target_id):
        if by is None:
            await self.conn.execute('DELETE FROM problem_resolutions WHERE entry_id = %s', (entry_id,))
        else:
            await self.conn.execute('''INSERT INTO problem_resolutions(entry_id, by_kind, target_id)
                VALUES (%s,%s,%s) ON CONFLICT (entry_id) DO UPDATE
                SET by_kind = EXCLUDED.by_kind, target_id = EXCLUDED.target_id, created_at = now()''',
                (entry_id, by, target_id))

    async def stale_entries(self, before, limit):
        rows = await (await self.conn.execute('''SELECT * FROM entries
            WHERE status = 'published' AND kind = 'problem' AND problem_state IN ('open','answered')
            AND last_activity_at <= %s ORDER BY id LIMIT %s FOR UPDATE SKIP LOCKED''',
            (before, limit))).fetchall()
        views = await self._views(rows)
        return [EntryRecord(view, row['author_id'], row['last_activity_at']) for view, row in zip(views, rows)]

    async def lock_graph(self):
        await self.conn.execute('SELECT pg_advisory_xact_lock(%s)', (GRAPH_LOCK,))

    async def lock_entries(self, entry_ids):
        await self.conn.execute('SELECT id FROM entries WHERE id = ANY(%s) ORDER BY id FOR UPDATE',
                               (entry_ids,))

    async def put_link(self, from_id, to_id, rel, actor_id, note):
        await self.conn.execute('''INSERT INTO entry_links(from_id, to_id, rel, created_by, note)
            VALUES (%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING''',
            (from_id, to_id, rel, actor_id, note))

    async def search(self, terms, filters, viewer_ctx, after, limit):
        # Lexical retrieval is a bounded SQL page, never an in-process full-table load.
        # Terms and filters are values, not SQL fragments or wildcard patterns.
        text = sql.SQL("lower(concat_ws(' ', e.title, e.goal, e.approach, e.result))")
        where = [sql.SQL("e.status = 'published'")]
        args = []
        for key, value in filters.items():
            if key == 'topic':
                where.append(sql.SQL('''EXISTS (SELECT 1 FROM entry_topics et JOIN topics t ON t.id = et.topic_id
                    WHERE et.entry_id = e.id AND t.slug = %s)'''))
            else:
                where.append(sql.SQL('e.{} = %s').format(sql.Identifier(key)))
            args.append(value)
        for term in terms:
            where.append(sql.SQL('strpos({}, %s) > 0').format(text))
            args.append(term)
        scores, score_args = [], []
        for term in terms:
            scores.append(sql.SQL('(length({0}) - length(replace({0}, %s, \'\'))) / %s').format(text))
            score_args.extend((term, len(term)))
        for key, value in viewer_ctx.items():
            scores.append(sql.SQL('''(SELECT count(*) FROM entry_context c
                WHERE c.entry_id = e.id AND c.key = %s AND c.value = %s)'''))
            score_args.extend((key, value))
        score = sql.SQL(' + ').join(scores) if scores else sql.SQL('0')
        seek = sql.SQL('WHERE (rank_score, published_at, id) < (%s,%s,%s)') if after else sql.SQL('')
        seek_args = [after.score, after.published_at, after.entry_id] if after else []
        query = sql.SQL('''WITH ranked AS (SELECT e.*, ({}) AS rank_score FROM entries e WHERE {})
            SELECT * FROM ranked {} ORDER BY rank_score DESC, published_at DESC, id DESC LIMIT %s''').format(
                score, sql.SQL(' AND ').join(where), seek)
        rows = await (await self.conn.execute(query, [*score_args, *args, *seek_args, limit + 1])).fetchall()
        last = rows[limit - 1] if len(rows) > limit else None
        position = SearchPosition(last['rank_score'], last['published_at'], last['id']) if last else None
        return await self._views(rows[:limit]), position
