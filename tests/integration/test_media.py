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
    item['view'].alt_text = 'Two clay pots holding tomatoes.'
    item['candidate_manifest'] = {'v': 1, 'id': str(media_id), 'kind': 'image',
        'alt': item['view'].alt_text, 'sources': [{'path': f'/m/{media_id}/320.webp',
        'bytes': 5, 'mime': 'image/webp', 'width': 320, 'height': 240}]}
    await blob.put(f'clean/{media_id}/320.webp', b'clean', 'image/webp', bucket='private')
    with pytest.raises(Forbidden):
        await review.approve(author, media_id)
    await review.approve(moderator, media_id)
    assert blob.public == {}
    assert item['view'].manifest is None
    await review.publish_approved(media_id)
    await review.publish_approved(media_id)
    assert item['view'].manifest is not None
    assert list(blob.public.values()) == [(b'clean', 'image/webp')]
    await review.reject(moderator, media_id, 'Private material')
    assert blob.public == {}
    assert item['view'].variants == {}
    assert item['view'].manifest is None


async def test_publication_waits_for_review_and_late_jobs_do_not_undo_takedown():
    repo, blob = MemoryRepository(), FakeBlobStore()
    author, moderator = Account(uuid4()), Account(uuid4(), is_moderator=True)
    repo.pilot_accounts.add(author.id)
    entry = await EntryService(repo).create_draft(author, EntryCreate(kind='idea', template='everyday',
        title='A media lifecycle test', goal='Keep original bytes private', approach='Test publication', lang='en'), 'entry')
    service, review = MediaService(repo, blob), MediaReviewService(repo, blob)
    ticket = await service.request_upload(author, entry.id, 'image', 3, 'image/png', 'upload')
    media_id = ticket['id']
    item = repo.media[media_id]
    await review.publish_approved(media_id)
    assert blob.public == {}
    item['view'].status = 'ready'
    item['view'].alt_text = 'A tested image.'
    item['scans_clean'] = True
    item['sanitized'] = {'320.webp': f'clean/{media_id}/320.webp', 'private-ocr.txt': f'clean/{media_id}/private-ocr.txt'}
    await blob.put(f'clean/{media_id}/320.webp', b'clean', 'image/webp', bucket='private')
    await blob.put(f'clean/{media_id}/private-ocr.txt', b'private scan text', 'text/plain', bucket='private')
    with pytest.raises(ValidationFailed): await review.approve(moderator, media_id)
    assert item['view'].review_status == 'pending_review'
    item['candidate_manifest'] = {'v': 1, 'id': str(media_id), 'kind': 'image', 'alt': 'A tested image.',
        'sources': [{'path': f'/m/{media_id}/320.webp', 'bytes': 5, 'mime': 'image/webp', 'width': 320, 'height': 240}]}
    await review.approve(moderator, media_id)
    assert blob.public == {}
    item['sanitized']['320.webp'] = item['key']  # A later worker update cannot replace approved outputs.
    await review.publish_approved(media_id)
    assert set(blob.public) == {f'm/{media_id}/320.webp'}
    await review.reject(moderator, media_id, 'Takedown test')
    await review.publish_approved(media_id)
    assert blob.public == {}
    assert item['view'].manifest is None
