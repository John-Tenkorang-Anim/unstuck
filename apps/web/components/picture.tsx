"use client";
import { useEffect, useRef, useState } from "react";
import { useNotebook } from "./notebook-provider";
import type { Picture as Pic } from "@/lib/types";

/**
 * A credited photo. Light reading omits the image until the reader requests it.
 */
export function Picture({
  picture,
  sizes = "(max-width: 760px) 100vw, 640px",
  className = "",
  caption,
  credit = true,
  id,
}: {
  picture: Pic;
  sizes?: string;
  className?: string;
  caption?: string;
  credit?: boolean;
  id?: string;
}) {
  const { lite } = useNotebook();
  const [requested, setRequested] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const image = useRef<HTMLImageElement>(null);
  const allowed = !lite || requested;
  useEffect(() => {
    if (allowed && image.current?.complete && image.current.naturalWidth === 0)
      setFailed(true);
  }, [allowed, attempt]);
  return (
    <figure className={`pic ${className}`} id={id}>
      <div className="pic-frame">
        {!allowed || failed ? (
          <div className="pic-placeholder">
            <p>{picture.alt}</p>
            {failed && (
              <p role="status">
                The image couldn’t load. Its description is still available.
              </p>
            )}
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setFailed(false);
                setRequested(true);
                setAttempt((n) => n + 1);
              }}
            >
              {failed ? "Try loading again" : "Load photo"}
            </button>
          </div>
        ) : (
          <a
            href={picture.src}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open full-size photo"
          >
            <img
              key={attempt}
              ref={image}
              src={picture.small}
              srcSet={
                picture.small !== picture.src
                  ? `${picture.small} 640w, ${picture.src} 1200w`
                  : undefined
              }
              sizes={sizes}
              width={picture.width}
              height={picture.height}
              alt={picture.alt}
              loading="lazy"
              decoding="async"
              onError={() => setFailed(true)}
            />
          </a>
        )}
      </div>
      {(caption || credit) && (
        <figcaption>
          {caption && <span>{caption}</span>}
          {credit && <Credit credit={picture.credit} />}
        </figcaption>
      )}
    </figure>
  );
}
export function Credit({ credit }: { credit: Pic["credit"] }) {
  return (
    <span className="credit">
      {credit.author} ·{" "}
      {credit.source ? (
        <a href={credit.source} target="_blank" rel="noopener noreferrer">
          {credit.license} · Source
        </a>
      ) : (
        credit.license
      )}
    </span>
  );
}
