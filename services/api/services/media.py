"""Upload admission and idempotent finalization. Originals always stay private."""
from uuid import uuid4
from domain.errors import Conflict, NotFound, ValidationFailed, Forbidden
from domain.models import MediaView
from settings import get_settings

LIMITS = {'image': 15 * 2**20, 'video': 100 * 2**20, 'pdf': 20 * 2**20,
          'csv': 5 * 2**20, 'code': 200 * 2**10, 'audio_note': 10 * 2**20}
MIMES = {'image': {'image/jpeg', 'image/png', 'image/webp'},
         'video': {'video/mp4', 'video/webm', 'video/quicktime'},
         'pdf': {'application/pdf'}, 'csv': {'text/csv'}, 'code': {'text/plain'},
         'audio_note': {'audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg'}}


class MediaService:
    def __init__(self, repo, blob):
        self.repo, self.blob = repo, blob

    def load(self, media_id):
        item = self.repo.media.get(media_id)
        if item is None:
            raise NotFound('media not found')
        return item

    async def request_upload(self, actor, entry_id, kind, size, mime, idem_key):
        self.repo.active(actor)
        if get_settings().UPLOADS_OPEN_TO != 'all' and actor.id not in self.repo.pilot_accounts:
            raise Forbidden('uploads are limited to the pilot')
        if kind not in LIMITS or type(size) is not int or not 0 < size <= LIMITS[kind]:
            raise ValidationFailed('unsupported media kind or size')
        if mime not in MIMES[kind] or not idem_key or len(idem_key) > 200:
            raise ValidationFailed('invalid content type or idempotency key')
        async with self.repo.lock:
            entry = self.repo.entry(entry_id, actor, own=True)
            key = (actor.id, 'media', idem_key)
            payload = (entry_id, kind, size, mime)
            if key in self.repo.idempotency:
                previous, media_id = self.repo.idempotency[key]
                if previous != payload:
                    raise Conflict('idempotency key was used with a different request')
                item = self.load(media_id)
                ticket = await self.blob.presign_put(item['key'], mime, size)
                return {'id': media_id, 'upload': ticket}
            if kind == 'image' and sum(m.kind == 'image' for m in entry.media) >= 8:
                raise ValidationFailed('at most eight images are allowed per entry')
            media_id = uuid4()
            ticket = await self.blob.presign_put(f'orig/{media_id}', mime, size)
            view = MediaView(id=media_id, kind=kind, status='pending', review_status='pending_review')
            self.repo.media[media_id] = {'entry_id': entry_id, 'owner': actor.id, 'size': size,
                'mime': mime, 'key': ticket.key, 'view': view, 'sanitized': {}, 'scans_clean': False}
            entry.media.append(view)
            self.repo.idempotency[key] = (payload, media_id)
            return {'id': media_id, 'upload': ticket}

    async def finalize(self, actor, media_id):
        async with self.repo.lock:
            item = self.load(media_id)
            self.repo.entry(item['entry_id'], actor, own=True)
            view = item['view']
            if view.status != 'pending':
                return view.model_copy(deep=True)
            info = await self.blob.head(item['key'])
            if info is None or info.size != item['size'] or info.content_type != item['mime']:
                raise ValidationFailed('uploaded object does not match the upload ticket')
            view.status = 'queued'
            self.repo.state_events.append({'entity': 'media', 'id': str(media_id),
                                           'from': 'pending', 'to': 'queued'})
            self.repo.outbox.append(('jobs:media', {'v': 1, 'name': 'media.process', 'media_id': str(media_id)}))
            return view.model_copy(deep=True)
