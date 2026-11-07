"""Only sanitized, scanned outputs are eligible for public storage."""
from domain.errors import Forbidden, ValidationFailed
from services.media import MediaService
from domain.media import PublicMediaManifest, delivery_assets
from pydantic import ValidationError


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
            manifest = None
            if view.kind in ('image', 'video'):
                try:
                    manifest = PublicMediaManifest.model_validate(item.get('candidate_manifest'))
                except ValidationError:
                    raise ValidationFailed('accessible delivery metadata is required before approval') from None
                if manifest.root.id != media_id or manifest.root.kind != view.kind:
                    raise ValidationFailed('delivery metadata must match the media item')
                assets = delivery_assets(manifest)
                if view.kind == 'image':
                    if not view.alt_text or view.alt_text.strip() != manifest.root.alt:
                        raise ValidationFailed('the approved image description must match its alt text')
                declared = {asset.path.removeprefix('/') for asset in assets}
                available = {f'm/{media_id}/{name}' for name in item['sanitized']}
                if not declared.issubset(available):
                    raise ValidationFailed('delivery metadata references missing sanitized outputs')
                for asset in assets:
                    key = item['sanitized'][asset.path.rsplit('/', 1)[-1]]
                    info = await self.blob.head(key)
                    if info is None or info.size != asset.bytes or info.content_type != asset.mime:
                        raise ValidationFailed('delivery metadata does not match the sanitized object')
            # Approval is committed before a publication job can expose any bytes.
            item['approved_manifest'] = manifest
            names = ({asset.path.rsplit('/', 1)[-1] for asset in delivery_assets(manifest)}
                     if manifest else set(item['sanitized']))
            item['approved_outputs'] = {name: item['sanitized'][name] for name in names}
            view.review_status = 'approved'
            view.variants = {}
            view.manifest = None
            self.repo.state_events.append({'entity': 'media', 'id': str(media_id),
                                           'from': 'pending_review', 'to': 'approved'})
            self.repo.outbox.append(('jobs:media', {'v': 1, 'name': 'media.publish',
                                                   'media_id': str(media_id)}))
            self.repo.emit(self.repo.entries[item['entry_id']])
            return view.model_copy(deep=True)

    async def publish_approved(self, media_id):
        """Idempotent publication job; never grants approval.

        The memory lock serializes this with takedown. A persistent adapter must
        provide an equivalent per-media transaction/lease across all workers.
        """
        async with self.repo.lock:
            item = self.load(media_id)
            view = item['view']
            if view.review_status != 'approved':
                return view.model_copy(deep=True)
            if view.variants:
                return view.model_copy(deep=True)
            prefix = f'm/{media_id}/'
            public = {}
            try:
                manifest = item.get('approved_manifest')
                outputs = item.get('approved_outputs', {})
                if not outputs:
                    raise ValidationFailed('approved output snapshot is missing')
                for name, key in sorted(outputs.items()):
                    if (not name or '/' in name or '\\' in name or name in ('.', '..') or
                        key == item['key'] or not key.startswith(f'clean/{media_id}/')):
                        raise ValidationFailed('invalid sanitized output path')
                    await self.blob.copy_to_public(key, prefix + name)
                    public[name] = prefix + name
            except Exception:
                await self.blob.delete_public(prefix)
                raise
            view.variants = public
            view.manifest = item.get('approved_manifest')
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
            view.manifest = None
            item.pop('approved_manifest', None)
            item.pop('approved_outputs', None)
            self.repo.emit(self.repo.entries[item['entry_id']])
            return view.model_copy(deep=True)
