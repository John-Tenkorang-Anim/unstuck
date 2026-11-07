/* Generated from the canonical Python schema. Run npm run contracts:generate. */

/**
 * A delivery contract independent of the web framework and storage provider.
 */
export type PublicMediaManifest = ImageManifest | VideoManifest;
export type V = 1;
export type Id = string;
export type Kind = "image";
export type Alt = string;
export type Caption = string | null;
export type Path = string;
export type Bytes = number;
export type Mime = "image/jpeg" | "image/png" | "image/webp" | "image/avif";
export type Width = number;
export type Height = number;
/**
 * @minItems 1
 * @maxItems 8
 */
export type Sources = ImageAsset[];
export type V1 = 1;
export type Id1 = string;
export type Kind1 = "video";
export type Title = string;
export type DurationSeconds = number;
export type HasAudio = boolean;
export type Path1 = string;
export type Bytes1 = number;
export type Mime1 = "video/mp4" | "video/webm";
export type Width1 = number;
export type Height1 = number;
/**
 * @minItems 1
 * @maxItems 4
 */
export type Sources1 = VideoAsset[];
export type Path2 = string;
export type Bytes2 = number;
export type Mime2 = "text/vtt";
export type Language = string;
export type Label = string;
export type HumanReviewed = true;
/**
 * @maxItems 12
 */
export type Captions = CaptionTrack[];
export type DescriptiveTranscript = string;

export interface ImageManifest {
  v: V;
  id: Id;
  kind: Kind;
  alt: Alt;
  caption: Caption;
  sources: Sources;
}
export interface ImageAsset {
  path: Path;
  bytes: Bytes;
  mime: Mime;
  width: Width;
  height: Height;
}
export interface VideoManifest {
  v: V1;
  id: Id1;
  kind: Kind1;
  title: Title;
  duration_seconds: DurationSeconds;
  has_audio: HasAudio;
  sources: Sources1;
  poster: ImageAsset;
  captions: Captions;
  descriptive_transcript: DescriptiveTranscript;
  described_source: VideoAsset | null;
}
export interface VideoAsset {
  path: Path1;
  bytes: Bytes1;
  mime: Mime1;
  width: Width1;
  height: Height1;
}
export interface CaptionTrack {
  path: Path2;
  bytes: Bytes2;
  mime: Mime2;
  language: Language;
  label: Label;
  human_reviewed: HumanReviewed;
}
