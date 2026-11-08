"use client";
import { useEffect, useRef, useState } from 'react';
import { useNotebook } from './notebook-provider';
import type { Picture } from '@/lib/types';

/** Decorative record previews never fetch in light reading or block the text. */
export function RecordImage({ picture, featured = false }: { picture: Picture; featured?: boolean }) {
  const { lite } = useNotebook();
  const [failed, setFailed] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => { if (!lite && image.current?.complete && image.current.naturalWidth === 0) setFailed(true); }, [lite]);
  if (lite || failed) return <span className={`image-placeholder${featured ? ' image-placeholder-featured' : ''}`} aria-hidden="true" />;
  return <img ref={image} src={picture.small} srcSet={picture.src !== picture.small ? `${picture.small} 640w, ${picture.src} 1200w` : undefined}
    sizes={featured ? '(max-width: 900px) 90vw, 720px' : '(max-width: 760px) 96px, 144px'}
    alt="" width={picture.width} height={picture.height} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
