"""Development lexical retrieval. Visibility is filtered before ranking and paging."""
from domain.errors import ValidationFailed


class SearchService:
    def __init__(self, repo):
        self.repo = repo

    async def search(self, q, filters=None, viewer_ctx=None, cursor=None, limit=20):
        if not 1 <= limit <= 100:
            raise ValidationFailed('limit must be between 1 and 100')
        try:
            offset = int(cursor or 0)
            if offset < 0:
                raise ValueError
        except ValueError:
            raise ValidationFailed('invalid cursor') from None
        filters = filters or {}
        allowed = {'kind', 'template', 'outcome', 'lang', 'topic'}
        if filters.keys() - allowed:
            raise ValidationFailed('unknown search filter')
        terms = q.casefold().split()
        scored = []
        for entry in self.repo.entries.values():
            if entry.status != 'published':
                continue
            if any((value not in [t.slug for t in entry.topics] if key == 'topic' else
                    str(getattr(entry, key)) != value) for key, value in filters.items()):
                continue
            text = ' '.join(filter(None, [entry.title, entry.goal, entry.approach, entry.result])).casefold()
            if terms and not all(term in text for term in terms):
                continue
            score = sum(text.count(term) for term in terms)
            score += sum(entry.context.get(k) == v for k, v in (viewer_ctx or {}).items())
            scored.append((score, entry.published_at, str(entry.id), entry))
        scored.sort(key=lambda row: row[:3], reverse=True)
        rows = scored[offset:offset + limit]
        return {'items': [row[3].model_copy(deep=True) for row in rows],
                'next_cursor': str(offset + limit) if offset + limit < len(scored) else None}
