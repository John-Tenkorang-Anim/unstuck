"""Versioned public delivery metadata. Never contains upload or private storage keys."""
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, RootModel, model_validator


class DeliveryModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True, json_schema_serialization_defaults_required=True)


class Asset(DeliveryModel):
    path: str = Field(pattern=r'^/m/[0-9a-fA-F-]{36}/[A-Za-z0-9][A-Za-z0-9._-]*$')
    bytes: int = Field(gt=0, le=200 * 2**20)


class ImageAsset(Asset):
    mime: Literal['image/jpeg', 'image/png', 'image/webp', 'image/avif']
    bytes: int = Field(gt=0, le=2**20)
    width: int = Field(gt=0, le=1600)
    height: int = Field(gt=0, le=1600)


class VideoAsset(Asset):
    mime: Literal['video/mp4', 'video/webm']
    bytes: int = Field(gt=0, le=20 * 2**20)
    width: int = Field(gt=0, le=1280)
    height: int = Field(gt=0, le=1280)

    @model_validator(mode='after')
    def bounded_decode_size(self):
        if self.width * self.height > 1280 * 720:
            raise ValueError('video delivery is capped at 720p-equivalent pixels')
        return self


class CaptionTrack(Asset):
    bytes: int = Field(gt=0, le=256 * 1024)
    mime: Literal['text/vtt']
    language: str = Field(pattern=r'^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$')
    label: str = Field(min_length=1, max_length=80)
    human_reviewed: Literal[True]


class ImageManifest(DeliveryModel):
    v: Literal[1]
    id: UUID
    kind: Literal['image']
    alt: str = Field(min_length=1, max_length=2000)
    caption: str | None = Field(default=None, max_length=2000)
    sources: list[ImageAsset] = Field(min_length=1, max_length=8)

    @model_validator(mode='after')
    def paths_belong_to_media(self):
        validate_asset_paths(self.id, self.sources)
        if len({(s.mime, s.width) for s in self.sources}) != len(self.sources):
            raise ValueError('image source widths must be unique within each format')
        return self


class VideoManifest(DeliveryModel):
    v: Literal[1]
    id: UUID
    kind: Literal['video']
    title: str = Field(min_length=1, max_length=200)
    duration_seconds: float = Field(gt=0, le=60, allow_inf_nan=False)
    has_audio: bool
    sources: list[VideoAsset] = Field(min_length=1, max_length=4)
    poster: ImageAsset
    captions: list[CaptionTrack] = Field(max_length=12)
    descriptive_transcript: str = Field(min_length=1, max_length=20000)
    described_source: VideoAsset | None = None

    @model_validator(mode='after')
    def accessible_delivery(self):
        if self.has_audio and not self.captions:
            raise ValueError('video with audio needs reviewed captions')
        assets = [*self.sources, self.poster, *self.captions]
        if self.described_source:
            assets.append(self.described_source)
        validate_asset_paths(self.id, assets)
        if len({min(s.width, s.height) for s in self.sources}) != len(self.sources):
            raise ValueError('video source qualities must be unique')
        if len({c.language.lower() for c in self.captions}) != len(self.captions):
            raise ValueError('caption languages must be unique')
        return self


def validate_asset_paths(media_id: UUID, assets: list[Asset]):
    prefix = f'/m/{media_id}/'
    if any(not asset.path.startswith(prefix) for asset in assets):
        raise ValueError('delivery assets must belong to this media item')


class PublicMediaManifest(RootModel[ImageManifest | VideoManifest]):
    """A delivery contract independent of the web framework and storage provider."""


def delivery_assets(manifest: PublicMediaManifest) -> list[Asset]:
    media = manifest.root
    if isinstance(media, ImageManifest):
        return list(media.sources)
    return [*media.sources, media.poster, *media.captions,
            *([media.described_source] if media.described_source else [])]
