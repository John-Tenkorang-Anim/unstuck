"""Public development feeds use the same visibility gate as search."""
from services.search import SearchService


class FeedService:
    def __init__(self, repo):
        self.search = SearchService(repo)

    async def home(self, actor=None, cursor=None):
        return await self.search.search('', cursor=cursor)
