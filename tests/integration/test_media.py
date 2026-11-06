from uuid import uuid4
import pytest
from adapters.fakes import FakeBlobStore
from adapters.memory import MemoryRepository
from domain.errors import Forbidden, ValidationFailed
from domain.models import EntryCreate
from services._actor import Account
from services.entries import EntryService
from services.media import MediaService
from services.media_review import MediaReviewService


async def test_T10_upload_private_finalize_idempotent_review_and_takedown():
    repo, blob = MemoryRepository(), FakeBlobStore()
    author, moderator = Account(uuid4()), Account(uuid4(), is_moderator=True)
    repo.pilot_accounts.add(author.id)
    entry = await EntryService(repo).create_draft(author, EntryCreate(kind='idea', template='everyday',
        title='An example image entry', goal='Show an idea', approach='Try this', lang='en'), 'entry')
    media, review = MediaService(repo, blob), MediaReviewService(repo, blob)
    ticket = await media.request_upload(author, entry.id, 'image', 3, 'image/png', 'image')
    media_id = ticket['id']
    assert blob.public == {}
    await blob.put(ticket['upload'].key, b'raw', 'image/png', bucket='private')
    await media.finalize(author, media_id)
    await media.finalize(author, media_id)
    assert sum(stream == 'jobs:media' for stream, _ in repo.outbox) == 1
    assert blob.public == {}
    with pytest.raises(ValidationFailed):
        await review.approve(moderator, media_id)
    item = repo.media[media_id]
    item['view'].status = 'ready'
    item['sanitized'] = {'320.webp': f'clean/{media_id}/320.webp'}
    item['scans_clean'] = True
    await blob.put(f'clean/{media_id}/320.webp', b'clean', 'image/webp', bucket='private')
    with pytest.raises(Forbidden):
        await review.approve(author, media_id)
    await review.approve(moderator, media_id)
    assert list(blob.public.values()) == [(b'clean', 'image/webp')]
    await review.reject(moderator, media_id, 'Private material')
    assert blob.public == {}
    assert item['view'].variants == {}
