"""Only sanitized, scanned outputs are eligible for public storage."""
from domain.errors import Forbidden, ValidationFailed
from services.media import MediaService


class MediaReviewService(MediaService):
    async def auto_review(self, media_id):
        # Automatic approval stays disabled until all specified scan integrations exist.
        self.load(media_id)
        return 'queued'

    async def approve(self, moderator, media_id):
        self.repo.active(moderator)
        if not moderator.is_moderator:
            raise Forbidden('a moderator is required')
        async with self.repo.lock:
            item = self.load(media_id)
            view = item['view']
            if view.review_status == 'approved':
                return view.model_copy(deep=True)
            if view.review_status != 'pending_review' or view.status != 'ready':
                raise ValidationFailed('media must be ready and awaiting review')
            if not item['scans_clean'] or not item['sanitized']:
                raise ValidationFailed('sanitized outputs and clean scans are required')
            prefix = f'm/{media_id}/'
            public = {}
            try:
                for name, key in item['sanitized'].items():
                    if (not name or '/' in name or '\\' in name or name in ('.', '..') or
                        key == item['key'] or not key.startswith(f'clean/{media_id}/')):
                        raise ValidationFailed('invalid sanitized output path')
                    await self.blob.copy_to_public(key, prefix + name)
                    public[name] = prefix + name
            except Exception:
                await self.blob.delete_public(prefix)
                raise
            view.review_status = 'approved'
            view.variants = public
            self.repo.state_events.append({'entity': 'media', 'id': str(media_id),
                                           'from': 'pending_review', 'to': 'approved'})
            self.repo.emit(self.repo.entries[item['entry_id']])
            return view.model_copy(deep=True)

    async def reject(self, moderator, media_id, reason):
        self.repo.active(moderator)
        if not moderator.is_moderator:
            raise Forbidden('a moderator is required')
        if not reason or not reason.strip():
            raise ValidationFailed('a rejection reason is required')
        async with self.repo.lock:
            item = self.load(media_id)
            view = item['view']
            await self.blob.delete_public(f'm/{media_id}/')
            if view.review_status != 'rejected':
                self.repo.state_events.append({'entity': 'media', 'id': str(media_id),
                                               'from': view.review_status, 'to': 'rejected'})
            view.review_status = 'rejected'
            view.variants = {}
            self.repo.emit(self.repo.entries[item['entry_id']])
            return view.model_copy(deep=True)
