"use client";
import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { formatBytes } from "@/lib/media/delivery";
import { clock } from "@/lib/search";
import type { Clip } from "@/lib/types";
import { useNotebook } from "./notebook-provider";
import { Credit } from "./picture";

/**
 * A video with its marked moments: the second it broke, the second it worked,
 * and notes in between. Moments are a navigable list with text descriptions,
 * so the failure point is reachable by keyboard and readable without playback.
 */
export function MomentPlayer({ clip, start }: { clip: Clip; start?: number }) {
  const { lite } = useNotebook();
  const video = useRef<HTMLVideoElement>(null);
  const [requested, setRequested] = useState(false);
  const [time, setTime] = useState(start ?? 0);
  const [active, setActive] = useState<number | null>(
    start === undefined ? null : nearest(start),
  );
  const allowed = !lite || requested;
  function nearest(t: number) {
    let index = 0;
    clip.moments.forEach((m, i) => {
      if (m.at <= t + 0.5) index = i;
    });
    return index;
  }
  useEffect(() => {
    if (start === undefined || !video.current) return;
    const element = video.current;
    const seek = () => {
      element.currentTime = start;
    };
    if (element.readyState >= 1) seek();
    else {
      element.preload = "metadata";
      element.addEventListener("loadedmetadata", seek, { once: true });
    }
  }, [start, allowed]);
  function jump(index: number) {
    setActive(index);
    const element = video.current;
    if (!element) {
      setTime(clip.moments[index].at);
      return;
    }
    element.currentTime = clip.moments[index].at;
    setTime(clip.moments[index].at);
  }
  const progress = Math.min(1, time / clip.duration);
  return (
    <section
      className="moment-player"
      id="clip"
      aria-label={`Video: ${clip.title}`}
    >
      <div className="player-frame">
        {allowed ? (
          <video
            ref={video}
            controls
            playsInline
            preload="none"
            poster={clip.poster.src}
            width={clip.poster.width}
            height={clip.poster.height}
            aria-label={clip.title}
            onTimeUpdate={(event) => {
              const t = event.currentTarget.currentTime;
              setTime(t);
              setActive(nearest(t));
            }}
          >
            <source src={clip.src} type={clip.type} />
            Your browser can’t play this video. Each marked moment is described
            below.
          </video>
        ) : (
          <div className="player-lite">
            <Play size={22} aria-hidden="true" />
            <p>Light reading keeps video off until you choose.</p>
            <button
              className="button button-outline"
              onClick={() => setRequested(true)}
            >
              Load video · {formatBytes(clip.bytes)}
            </button>
          </div>
        )}
      </div>
      <div className="timeline" aria-hidden="true">
        <span
          className="timeline-progress"
          style={{ width: `${progress * 100}%` }}
        />
        {clip.moments.map((moment, index) => (
          <span
            key={moment.at}
            className={`timeline-mark mark-${moment.kind} ${active === index ? "is-active" : ""}`}
            style={{ left: `${(moment.at / clip.duration) * 100}%` }}
          />
        ))}
      </div>
      <div className="player-head">
        <h2>{clip.title}</h2>
        <span>
          {clock(clip.duration)} ·{" "}
          {clip.moments.filter((m) => m.kind === "broke").length} failure points
          marked
        </span>
      </div>
      <ol className="moments">
        {clip.moments.map((moment, index) => (
          <li key={moment.at}>
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
      <p className="player-credit">
        Film: <Credit credit={clip.credit} />
      </p>
    </section>
  );
}
