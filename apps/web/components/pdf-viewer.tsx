"use client";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Pin } from "@/lib/sessions";

type Pending = { x: number; y: number; page?: number } | null;
const MAX_PAGES = 40;

/**
 * Renders each PDF page to a canvas with PDF.js, so feedback can point at a page
 * or pin a spot on it. The original file stays one click away for anyone who
 * prefers their own reader or uses a screen reader.
 */
export default function PdfViewer({
  src,
  name,
  pins,
  pending,
  focus,
  counts,
  placing,
  onPlace,
  onAnchor,
  onPages,
}: {
  src: string;
  name: string;
  pins: Pin[];
  pending: Pending;
  focus: string | null;
  counts: Record<string, number>;
  placing: boolean;
  onPlace: (page: number, x: number, y: number) => void;
  onAnchor: (key: string) => void;
  onPages?: (count: number) => void;
}) {
  const [pages, setPages] = useState<number>(0);
  const [error, setError] = useState("");
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | undefined;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
        const loading = pdfjs.getDocument({
          url: src,
          isEvalSupported: false,
        } as Parameters<typeof pdfjs.getDocument>[0]);
        task = loading;
        const doc = await loading.promise;
        if (cancelled) return;
        const count = Math.min(doc.numPages, MAX_PAGES);
        setPages(count);
        onPages?.(count);
        await new Promise((r) => requestAnimationFrame(r));
        const width = frame.current?.clientWidth ?? 640;
        for (let n = 1; n <= count && !cancelled; n++) {
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const scale =
            (width / base.width) * Math.min(2, window.devicePixelRatio || 1);
          const viewport = page.getViewport({ scale });
          const canvas = canvases.current[n - 1];
          if (!canvas) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvas, viewport }).promise;
        }
      } catch {
        if (!cancelled)
          setError(
            "This PDF couldn’t be displayed here. You can still open the file.",
          );
      }
    })();
    return () => {
      cancelled = true;
      task?.destroy().catch(() => undefined);
    };
    // Rendering depends only on the file; callbacks change on every render.
  }, [src]);
  function place(event: MouseEvent<HTMLDivElement>, page: number) {
    if (!placing) return;
    const box = event.currentTarget.getBoundingClientRect();
    onPlace(
      page,
      Math.min(0.98, Math.max(0.02, (event.clientX - box.left) / box.width)),
      Math.min(0.98, Math.max(0.02, (event.clientY - box.top) / box.height)),
    );
  }
  return (
    <div className="pdf" ref={frame}>
      <p className="pdf-head">
        <span>{name}</span>
        <a href={src} target="_blank" rel="noopener noreferrer">
          Open the PDF <ArrowUpRight size={13} />
        </a>
      </p>
      {error && <p className="field-error">{error}</p>}
      {Array.from({ length: pages }, (_, i) => {
        const page = i + 1;
        const key = `page:${page}`;
        return (
          <section key={page} className="pdf-page" aria-label={`Page ${page}`}>
            <button
              className="pdf-page-no"
              aria-pressed={focus === key}
              onClick={() => onAnchor(key)}
            >
              Page {page}
              {counts[key] ? (
                <span className="anchor-count">{counts[key]}</span>
              ) : null}
            </button>
            <div
              className={`canvas-frame ${placing ? "is-placing" : ""}`}
              onClick={(e) => place(e, page)}
            >
              <canvas
                ref={(el) => void (canvases.current[i] = el)}
                aria-hidden="true"
              />
              {pins.map((pin, index) =>
                pin.page === page ? (
                  <button
                    key={pin.id}
                    className={`pin ${focus === `pin:${pin.id}` ? "is-focus" : ""}`}
                    style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                    aria-pressed={focus === `pin:${pin.id}`}
                    aria-label={`Pin ${index + 1} on page ${page}: ${pin.label}. ${counts[`pin:${pin.id}`] ?? 0} notes`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onAnchor(`pin:${pin.id}`);
                    }}
                  >
                    {index + 1}
                  </button>
                ) : null,
              )}
              {pending?.page === page && (
                <span
                  className="pin is-pending"
                  style={{
                    left: `${pending.x * 100}%`,
                    top: `${pending.y * 100}%`,
                  }}
                  aria-hidden="true"
                >
                  +
                </span>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
