"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { cleanCaptions } from "@/lib/media/captions";
import { formatBytes } from "@/lib/media/delivery";
import { clock } from "@/lib/search";
import type { Clip } from "@/lib/types";
import { useNotebook } from "./notebook-provider";
import { Credit } from "./picture";

/** Native playback, explicit low-data consent, and readable timed/text alternatives. */
export function MomentPlayer({ clip, start }: { clip: Clip; start?: number }) {
  const { lite } = useNotebook();
  const video = useRef<HTMLVideoElement>(null);
  const pendingSeek = useRef<number | undefined>(start);
  const [requested, setRequested] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [time, setTime] = useState(start ?? 0);
  const [active, setActive] = useState<number | null>(null);
  const allowed = !lite || requested;
  const duration =
    Number.isFinite(clip.duration) && clip.duration > 0 ? clip.duration : 60;
  const captions = useMemo(() => {
    try {
      return cleanCaptions(clip.captions);
    } catch {
      return undefined;
    }
  }, [clip.captions]);
  function nearest(t: number) {
    let index: number | null = null;
    clip.moments.forEach((moment, i) => {
      if (moment.at <= t + 0.5) index = i;
    });
    return index;
  }
  useEffect(() => {
    const element = video.current;
    if (!allowed || !element) return;
    if (element.error) setFailed(true);
    const seek = () => {
      if (pendingSeek.current === undefined) return;
      const end = Number.isFinite(element.duration)
        ? element.duration
        : duration;
      element.currentTime = Math.max(0, Math.min(pendingSeek.current, end));
      pendingSeek.current = undefined;
    };
    if (pendingSeek.current !== undefined) {
      if (element.readyState >= 1) seek();
      else {
        element.preload = "metadata";
        element.addEventListener("loadedmetadata", seek, { once: true });
      }
    }
    const pauseHidden = () => {
      if (document.hidden) element.pause();
    };
    const pauseOthers = () =>
      document
        .querySelectorAll<HTMLMediaElement>("video,audio")
        .forEach((other) => {
          if (other !== element) other.pause();
        });
    document.addEventListener("visibilitychange", pauseHidden);
    element.addEventListener("play", pauseOthers);
    return () => {
      element.removeEventListener("loadedmetadata", seek);
      element.removeEventListener("play", pauseOthers);
      document.removeEventListener("visibilitychange", pauseHidden);
    };
  }, [allowed, attempt, duration]);
  function jump(index: number) {
    const at = Math.max(0, Math.min(clip.moments[index].at, duration));
    pendingSeek.current = at;
    setActive(index);
    setTime(at);
    setRequested(true);
    const element = video.current;
    if (element && element.readyState >= 1) {
      element.currentTime = at;
      pendingSeek.current = undefined;
    } else if (element) {
      element.preload = "metadata";
      element.addEventListener(
        "loadedmetadata",
        () => {
          element.currentTime = at;
          pendingSeek.current = undefined;
        },
        { once: true },
      );
      element.load();
    }
  }
  return (
    <section
      className="moment-player"
      id="clip"
      aria-label={`Video: ${clip.title}`}
    >
      <div className="player-frame">
        {failed ? (
          <div className="player-lite" role="status">
            <p>
              The video couldn’t load. Its transcript and marked moments are
              still available below.
            </p>
            <button
              className="button button-outline"
              onClick={() => {
                setFailed(false);
                setAttempt((n) => n + 1);
              }}
            >
              <RotateCcw size={15} />
              Try again
            </button>
          </div>
        ) : allowed ? (
          <video
            key={attempt}
            ref={video}
            controls
            playsInline
            preload="none"
            poster={clip.poster?.src}
            width={clip.poster?.width}
            height={clip.poster?.height}
            aria-label={clip.title}
            onError={() => setFailed(true)}
            onTimeUpdate={(event) => {
              const t = event.currentTarget.currentTime;
              setTime(t);
              setActive(nearest(t));
            }}
          >
            <source src={clip.src} type={clip.type || undefined} />
            {captions && (
              <track
                kind="captions"
                label="Captions"
                srcLang={clip.captionLanguage ?? "en"}
                src={`data:text/vtt;charset=utf-8,${encodeURIComponent(captions)}`}
                default
              />
            )}
            Your browser can’t play this video. Read the transcript and marked
            moments below.
          </video>
        ) : (
          <div className="player-lite">
            <Play size={22} aria-hidden="true" />
            <p>Video loads when you choose.</p>
            <button
              className="button button-outline"
              onClick={() => setRequested(true)}
            >
              Load video{clip.bytes > 0 ? ` · ${formatBytes(clip.bytes)}` : ""}
            </button>
          </div>
        )}
      </div>
      <div className="timeline" aria-hidden="true">
        <span
          className="timeline-progress"
          style={{ width: `${Math.min(1, time / duration) * 100}%` }}
        />
        {clip.moments.map((moment, index) => (
          <span
            key={`${moment.at}-${index}`}
            className={`timeline-mark mark-${moment.kind} ${active === index ? "is-active" : ""}`}
            style={{ left: `${Math.min(1, moment.at / duration) * 100}%` }}
          />
        ))}
      </div>
      <div className="player-head">
        <h2>{clip.title}</h2>
        <span>
          {clock(duration)}
          {clip.moments.length > 0
            ? ` · ${clip.moments.length} marked moments`
            : ""}
        </span>
      </div>
      {clip.transcript ? (
        <details className="disclosure video-transcript">
          <summary>Read transcript</summary>
          <p>{clip.transcript}</p>
        </details>
      ) : (
        <p className="quiet-line">
          No transcript has been supplied for this recording.
        </p>
      )}
      {!captions && !clip.silent && (
        <p className="quiet-line">Captions have not been supplied.</p>
      )}
      <ol className="moments">
        {clip.moments.map((moment, index) => (
          <li key={`${moment.at}-${index}`}>
            <button
              className={`moment mark-${moment.kind}`}
              aria-current={active === index ? "true" : undefined}
              onClick={() => jump(index)}
            >
              <span className="moment-time">{clock(moment.at)}</span>
              <span className="moment-body">
                <strong>
                  {moment.kind === "broke" && (
                    <span className="moment-flag">Where it broke</span>
                  )}
                  {moment.label}
                </strong>
                {moment.detail && <span>{moment.detail}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {clip.credit && (
        <p className="player-credit">
          Film: <Credit credit={clip.credit} />
        </p>
      )}
    </section>
  );
}
