"use client";
import { useEffect, useRef, useState } from "react";
import { FileText, Play, RotateCcw } from "lucide-react";
import type { VideoManifest } from "@/lib/contracts/media-v1";
import { formatBytes, mediaUrl, videoSources } from "@/lib/media/delivery";
import { useNotebook } from "../notebook-provider";

export function AccessibleVideo({
  media,
  origin = "",
}: {
  media: VideoManifest;
  origin?: string;
}) {
  const { lite } = useNotebook();
  const variants = videoSources(media.sources);
  const [quality, setQuality] = useState(variants[0].path);
  const [requested, setRequested] = useState(false);
  const [described, setDescribed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const position = useRef(0);
  const allowed = !lite || requested;
  const source =
    described && media.described_source
      ? media.described_source
      : (variants.find((s) => s.path === quality) ?? variants[0]);
  useEffect(() => {
    if (allowed && video.current?.error) setFailed(true);
  }, [allowed, attempt, source.path]);
  useEffect(() => {
    function pauseWhenHidden() {
      if (document.hidden) video.current?.pause();
    }
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () =>
      document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);
  function changeSource(action: () => void) {
    if (video.current) {
      position.current = video.current.currentTime;
      video.current.pause();
    }
    setFailed(false);
    action();
  }
  function pauseOtherPlayers() {
    document
      .querySelectorAll<HTMLMediaElement>("video,audio")
      .forEach((player) => {
        if (player !== video.current) player.pause();
      });
  }
  return (
    <figure
      className="media-figure media-video"
      aria-label={`Video: ${media.title}`}
    >
      <div className="media-title">
        <Play size={15} aria-hidden="true" />
        <h3>{media.title}</h3>
        <span>{Math.ceil(media.duration_seconds)} seconds</span>
      </div>
      {!allowed ? (
        <div className="media-placeholder">
          <Play size={27} aria-hidden="true" />
          <p>A video is available with a descriptive transcript below.</p>
          <button
            className="button button-outline"
            onClick={() => setRequested(true)}
          >
            Load video · {formatBytes(variants[0].bytes)}
          </button>
          <span>The video will wait for you to press play.</span>
        </div>
      ) : failed ? (
        <div className="media-placeholder" role="status">
          <FileText size={25} aria-hidden="true" />
          <p>The video couldn’t load. You can still read its transcript.</p>
          <button
            className="button button-outline"
            onClick={() => {
              setFailed(false);
              setAttempt((a) => a + 1);
            }}
          >
            <RotateCcw size={14} /> Try the video again
          </button>
          <a href={mediaUrl(source.path, origin)} download>
            Open the video file · {formatBytes(source.bytes)}
          </a>
        </div>
      ) : (
        <video
          key={`${source.path}:${attempt}`}
          ref={video}
          controls
          playsInline
          preload="none"
          poster={mediaUrl(media.poster.path, origin)}
          width={source.width}
          height={source.height}
          aria-label={media.title}
          crossOrigin={origin ? "anonymous" : undefined}
          onPlay={pauseOtherPlayers}
          onError={() => setFailed(true)}
          onLoadedMetadata={() => {
            if (
              video.current &&
              position.current > 0 &&
              Number.isFinite(video.current.duration)
            )
              video.current.currentTime = Math.min(
                position.current,
                Math.max(0, video.current.duration - 0.1),
              );
          }}
        >
          <source src={mediaUrl(source.path, origin)} type={source.mime} />
          {media.captions.map((track, index) => (
            <track
              key={track.language}
              kind="captions"
              src={mediaUrl(track.path, origin)}
              srcLang={track.language}
              label={track.label}
              default={index === 0}
            />
          ))}
          Your browser cannot play this video. Its descriptive transcript
          follows.
        </video>
      )}
      <div className="video-preferences">
        {allowed && variants.length > 1 && (
          <label>
            Video quality
            <select
              aria-label={`Video quality for ${media.title}`}
              value={quality}
              disabled={described}
              onChange={(event) =>
                changeSource(() => setQuality(event.target.value))
              }
            >
              {variants.map((variant) => (
                <option key={variant.path} value={variant.path}>
                  {Math.min(variant.width, variant.height)}p ·{" "}
                  {formatBytes(variant.bytes)}
                </option>
              ))}
            </select>
          </label>
        )}
        {media.described_source && (
          <label className="description-toggle">
            <input
              type="checkbox"
              checked={described}
              onChange={(event) =>
                changeSource(() => setDescribed(event.target.checked))
              }
            />{" "}
            Use audio-described version
          </label>
        )}
        {allowed && variants.length > 1 && (
          <p>Quality changes pause playback and keep your place.</p>
        )}
      </div>
      <details className="media-transcript">
        <summary>
          <FileText size={16} aria-hidden="true" /> Read descriptive transcript
        </summary>
        <p>{media.descriptive_transcript}</p>
      </details>
      <figcaption>
        {media.has_audio
          ? "Reviewed captions available in the player."
          : "This video has no audio."}{" "}
        No autoplay. Your pace.
      </figcaption>
    </figure>
  );
}
