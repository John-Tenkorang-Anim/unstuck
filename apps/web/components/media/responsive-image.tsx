"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Image as ImageIcon, RotateCcw } from "lucide-react";
import type { ImageManifest } from "@/lib/contracts/media-v1";
import { formatBytes, imageSources, mediaUrl } from "@/lib/media/delivery";
import { useNotebook } from "../notebook-provider";

export function ResponsiveImage({
  media,
  origin = "",
}: {
  media: ImageManifest;
  origin?: string;
}) {
  const { lite } = useNotebook();
  const [requested, setRequested] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const image = useRef<HTMLImageElement>(null);
  const sources = imageSources(media.sources);
  const largest = sources.at(-1)!;
  const selected = lite ? [sources[0]] : sources;
  const fallback = selected.find((s) => s.mime === "image/jpeg") ?? selected[0];
  const allowed = !lite || requested;
  useEffect(() => {
    // SSR media may finish or fail before hydration attaches React event handlers.
    if (
      allowed &&
      !failed &&
      image.current?.complete &&
      image.current.naturalWidth === 0
    )
      setFailed(true);
  }, [allowed, failed, attempt]);
  return (
    <figure className="media-figure media-image" aria-label="Image attachment">
      {!allowed ? (
        <div className="media-placeholder">
          <ImageIcon size={26} aria-hidden="true" />
          <p>{media.alt}</p>
          <button
            className="button button-outline"
            onClick={() => setRequested(true)}
          >
            Load image · from {formatBytes(sources[0].bytes)}
          </button>
          <span>Light reading keeps images off until you choose.</span>
        </div>
      ) : failed ? (
        <div className="media-placeholder" role="status">
          <ImageIcon size={26} aria-hidden="true" />
          <p>{media.alt}</p>
          <span>
            The image couldn’t load. Its description is still available.
          </span>
          <button
            className="button button-outline"
            onClick={() => {
              setFailed(false);
              setAttempt((a) => a + 1);
            }}
          >
            <RotateCcw size={14} /> Try the image again
          </button>
        </div>
      ) : (
        <picture key={attempt}>
          {["image/avif", "image/webp", "image/jpeg", "image/png"].map(
            (mime) => {
              const variants = selected.filter(
                (source) => source.mime === mime,
              );
              return variants.length ? (
                <source
                  key={mime}
                  type={mime}
                  srcSet={variants
                    .map(
                      (source) =>
                        `${mediaUrl(source.path, origin)} ${source.width}w`,
                    )
                    .join(", ")}
                  sizes="(max-width: 580px) calc(100vw - 42px), (max-width: 760px) 60vw, 720px"
                />
              ) : null;
            },
          )}
          <img
            ref={image}
            src={mediaUrl(fallback.path, origin)}
            width={largest.width}
            height={largest.height}
            alt={media.alt}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        </picture>
      )}
      <figcaption>
        {media.caption && <p>{media.caption}</p>}
        {allowed && (
          <a
            href={mediaUrl(largest.path, origin)}
            target="_blank"
            rel="noopener noreferrer"
          >
            View full-size image · {formatBytes(largest.bytes)}{" "}
            <ArrowUpRight size={12} />
          </a>
        )}
      </figcaption>
    </figure>
  );
}
