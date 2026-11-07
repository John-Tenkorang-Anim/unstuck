"""Lexical retrieval with visibility filters and query-bound keyset pagination."""
from adapters.repository import CoreRepository
from domain.errors import ValidationFailed
from domain.pagination import decode_cursor, encode_cursor, query_digest


class SearchService:
    def __init__(self, repo: CoreRepository):
        self.repo = repo

    async def search(self, q, filters=None, viewer_ctx=None, cursor=None, limit=20):
        if not 1 <= limit <= 100:
            raise ValidationFailed('limit must be between 1 and 100')
        filters = filters or {}
        allowed = {'kind', 'template', 'outcome', 'lang', 'topic'}
        if filters.keys() - allowed:
            raise ValidationFailed('unknown search filter')
        if len(q) > 500:
            raise ValidationFailed('query must be at most 500 characters')
        terms = list(dict.fromkeys(q.lower().split()))
        if len(terms) > 32:
            raise ValidationFailed('query must contain at most 32 distinct terms')
        fingerprint = query_digest(terms, filters, viewer_ctx or {})
        after = decode_cursor(cursor, fingerprint)
        async with self.repo.transaction(readonly=True) as tx:
            items, position = await tx.search(terms, filters, viewer_ctx or {}, after, limit)
            return {'items': items, 'next_cursor': encode_cursor(position, fingerprint)}
