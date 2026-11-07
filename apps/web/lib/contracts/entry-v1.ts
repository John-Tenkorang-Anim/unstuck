/* Generated from the canonical Python schema. Run npm run contracts:generate. */

export type Id = string;
export type EntryKind = "experience" | "problem" | "solution" | "idea" | "discovery" | "research";
export type Template = "everyday" | "making" | "farming_food" | "software" | "research" | "work_business" | "community";
export type EntryStatus = "draft" | "pending_review" | "published" | "hidden" | "deleted";
export type Outcome = "worked" | "failed" | "mixed" | "ongoing";
export type ProblemState = "open" | "answered" | "solved" | "stale";
export type Title = string;
export type Goal = string;
export type Approach = string | null;
export type Result = string | null;
export type WhyText = string | null;
export type Advice = string | null;
export type WhyStatus = "unknown" | "suspected" | "author_confirmed" | "verified";
export type Alias = string;
export type IsAuthor = boolean;
export type SignedName = string | null;
export type Lang = string;
export type TranslationAvailable = boolean;
export type License = "CC-BY-4.0" | "CC-BY-SA-4.0" | "CC0-1.0";
export type Version = number;
export type Slug = string;
export type Name = string;
export type HighStakes = boolean;
export type Topics = TopicRef[];
export type Id1 = string;
export type Kind = string;
export type Status = string;
export type ReviewStatus = string;
export type AltText = string | null;
/**
 * A delivery contract independent of the web framework and storage provider.
 */
export type PublicMediaManifest = ImageManifest | VideoManifest;
export type V = 1;
export type Id2 = string;
export type Kind1 = "image";
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
export type Id3 = string;
export type Kind2 = "video";
export type Title1 = string;
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
export type Media = MediaView[];
export type SameCount = number;
export type NotSameCount = number;
export type WorkedCount = number;
export type DidntWorkCount = number;
export type HelpedCount = number;
export type SavedCount = number;
export type CommentCount = number;
export type SolvedForCount = number;
export type Frozen = boolean;
export type ToId = string;
export type LinkRel = "solves" | "next_attempt" | "replicates" | "contradicts" | "builds_on" | "duplicate_of";
export type Note = string | null;
export type Links = LinkView[];
export type HighStakes1 = boolean;
export type PublishedAt = string | null;

/**
 * What GET /entries/{id} returns. Never includes author_id or any account id.
 */
export interface EntryView {
  id: Id;
  kind: EntryKind;
  template: Template;
  status: EntryStatus;
  outcome: Outcome | null;
  problem_state: ProblemState | null;
  title: Title;
  goal: Goal;
  approach: Approach;
  result: Result;
  why_text: WhyText;
  advice: Advice;
  why_status: WhyStatus;
  author: PersonRef;
  lang: Lang;
  translation_available: TranslationAvailable;
  license: License;
  version: Version;
  topics: Topics;
  context: Context;
  type_fields: TypeFields;
  media: Media;
  stats: EntryStats;
  links: Links;
  high_stakes: HighStakes1;
  published_at: PublishedAt;
}
/**
 * How a person appears in any public payload (INV-01).
 *
 * alias: per-entry random name, e.g. "quiet-otter-41", or "Author".
 * is_author: true when this person wrote the entry being viewed.
 * signed_name: present only if the author signed this specific entry (v1.1).
 */
export interface PersonRef {
  alias: Alias;
  is_author: IsAuthor;
  signed_name: SignedName;
}
export interface TopicRef {
  slug: Slug;
  name: Name;
  high_stakes: HighStakes;
}
export interface Context {
  [k: string]: string;
}
export interface TypeFields {
  [k: string]: unknown;
}
export interface MediaView {
  id: Id1;
  kind: Kind;
  status: Status;
  review_status: ReviewStatus;
  alt_text: AltText;
  variants: Variants;
  manifest: PublicMediaManifest | null;
}
export interface Variants {
  [k: string]: unknown;
}
export interface ImageManifest {
  v: V;
  id: Id2;
  kind: Kind1;
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
  id: Id3;
  kind: Kind2;
  title: Title1;
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
/**
 * Absolute counts (INV-04, INV-13). Never an increment.
 */
export interface EntryStats {
  same_count: SameCount;
  not_same_count: NotSameCount;
  worked_count: WorkedCount;
  didnt_work_count: DidntWorkCount;
  helped_count: HelpedCount;
  saved_count: SavedCount;
  comment_count: CommentCount;
  solved_for_count: SolvedForCount;
  frozen: Frozen;
}
export interface LinkView {
  to_id: ToId;
  rel: LinkRel;
  note: Note;
}
