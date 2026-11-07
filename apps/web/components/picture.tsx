import type { Picture as Pic } from "@/lib/types";

/**
 * A credited photo. Light reading hides it before it loads, leaving the
 * description in its place, because lazy images that are never displayed are
 * never requested.
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
  return (
    <figure className={`pic ${className}`} id={id}>
      <div className="pic-frame" data-alt={picture.alt}>
        <img
          src={picture.small}
          srcSet={`${picture.small} 640w, ${picture.src} 1200w`}
          sizes={sizes}
          width={picture.width}
          height={picture.height}
          alt={picture.alt}
          loading="lazy"
          decoding="async"
        />
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
          {credit.license}, Wikimedia Commons
        </a>
      ) : (
        credit.license
      )}
    </span>
  );
}
