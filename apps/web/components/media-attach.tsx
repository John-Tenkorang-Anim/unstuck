"use client";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  Clipboard,
  Crosshair,
  FileText,
  Film,
  ImagePlus,
  Trash2,
} from "lucide-react";
import { getFile, putFile, removeFile } from "@/lib/local-media";
import { formatBytes } from "@/lib/media/delivery";
import { clock } from "@/lib/search";
import type { Pin } from "@/lib/sessions";
import type { Moment } from "@/lib/types";

export interface Attached {
  id: string;
  kind: "image" | "video" | "pdf";
  name: string;
  type: string;
  size: number;
  alt: string;
  duration?: number;
  pins: Pin[];
  moments: Moment[];
}
const limits = {
  images: 8,
  imageBytes: 15e6,
  videoBytes: 100e6,
  videoSeconds: 60,
  pdfBytes: 20e6,
};

function videoLength(url: string) {
  return new Promise<number>((resolve) => {
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => resolve(probe.duration);
    probe.onerror = () => resolve(NaN);
    probe.src = url;
  });
}

/**
 * Add photos and short videos by pasting, dropping or choosing files, then mark
 * the spot or the second that matters. Limits follow the platform spec.
 */
export function MediaAttach({
  value,
  onChange,
  single = false,
  label = "Photos and video",
}: {
  value: Attached[];
  onChange: (next: Attached[]) => void;
  single?: boolean;
  label?: string;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    let live = true;
    value.forEach(async (item) => {
      if (urls[item.id]) return;
      const blob = await getFile(item.id);
      if (blob && live)
        setUrls((u) => ({ ...u, [item.id]: URL.createObjectURL(blob) }));
    });
    return () => {
      live = false;
    };
  }, [value]);
  async function add(files: File[]) {
    setError("");
    let next = [...latest.current];
    for (const file of files) {
      const kind = file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("image/")
          ? "image"
          : file.type === "application/pdf"
            ? "pdf"
            : null;
      if (!kind) {
        setError(`${file.name} isn’t a photo, video or PDF.`);
        continue;
      }
      if (single && next.length) next.forEach((item) => removeFile(item.id));
      if (single) next = [];
      if (
        kind === "image" &&
        next.filter((i) => i.kind === "image").length >= limits.images
      ) {
        setError("Up to 8 photos per note.");
        break;
      }
      if (kind === "pdf" && file.size > limits.pdfBytes) {
        setError(`${file.name} is over 20 MB.`);
        continue;
      }
      if (kind === "image" && file.size > limits.imageBytes) {
        setError(`${file.name} is over 15 MB.`);
        continue;
      }
      if (
        kind === "video" &&
        (file.size > limits.videoBytes || next.some((i) => i.kind === "video"))
      ) {
        setError(
          file.size > limits.videoBytes
            ? `${file.name} is over 100 MB.`
            : "One video per note.",
        );
        continue;
      }
      const url = URL.createObjectURL(file);
      const duration = kind === "video" ? await videoLength(url) : undefined;
      if (duration && duration > limits.videoSeconds + 0.5) {
        setError(
          `Videos can be up to 60 seconds. This one is ${clock(duration)}.`,
        );
        URL.revokeObjectURL(url);
        continue;
      }
      const id = `m-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      await putFile(id, file);
      setUrls((u) => ({ ...u, [id]: url }));
      next = [
        ...next,
        {
          id,
          kind,
          name: file.name || "Pasted image",
          type: file.type,
          size: file.size,
          alt: "",
          duration,
          pins: [],
          moments: [],
        },
      ];
    }
    onChange(next);
  }
  useEffect(() => {
    function paste(event: ClipboardEvent) {
      const files = [...(event.clipboardData?.files ?? [])];
      if (!files.length) return;
      event.preventDefault();
      add(files);
    }
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  });
  const update = (id: string, change: Partial<Attached>) =>
    onChange(
      value.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );
  return (
    <div className="attach">
      <div
        className={`dropzone ${dragging ? "is-over" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          add([...event.dataTransfer.files]);
        }}
      >
        <p className="dropzone-title">{label}</p>
        <p>
          <Clipboard size={14} aria-hidden="true" /> Paste a screenshot with{" "}
          <kbd>⌘V</kbd>, drop files here, or{" "}
          <button
            type="button"
            className="text-link"
            onClick={() => input.current?.click()}
          >
            choose files
          </button>
          .
        </p>
        <p className="dropzone-limits">
          {single
            ? "One photo, a video up to 60 seconds, or a PDF up to 20 MB."
            : "Up to 8 photos, 15 MB each, and one video up to 60 seconds."}{" "}
          Files stay on this device.
        </p>
        <input
          ref={input}
          type="file"
          hidden
          multiple={!single}
          accept="image/*,video/*,application/pdf"
          onChange={(event) => {
            add([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {value.map((item) => (
        <AttachedItem
          key={item.id}
          item={item}
          url={urls[item.id]}
          onChange={(change) => update(item.id, change)}
          onRemove={() => {
            removeFile(item.id);
            onChange(value.filter((other) => other.id !== item.id));
          }}
        />
      ))}
    </div>
  );
}

function AttachedItem({
  item,
  url,
  onChange,
  onRemove,
}: {
  item: Attached;
  url?: string;
  onChange: (change: Partial<Attached>) => void;
  onRemove: () => void;
}) {
  const [placing, setPlacing] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  function place(event: MouseEvent<HTMLDivElement>) {
    if (!placing) return;
    const box = event.currentTarget.getBoundingClientRect();
    onChange({
      pins: [
        ...item.pins,
        {
          id: `p${Date.now()}`,
          x: (event.clientX - box.left) / box.width,
          y: (event.clientY - box.top) / box.height,
          label: "",
        },
      ],
    });
    setPlacing(false);
  }
  return (
    <div className="attached">
      <div className="attached-head">
        {item.kind === "image" ? (
          <ImagePlus size={15} />
        ) : item.kind === "pdf" ? (
          <FileText size={15} />
        ) : (
          <Film size={15} />
        )}
        <span>{item.name}</span>
        <small>
          {formatBytes(item.size)}
          {item.duration ? ` · ${clock(item.duration)}` : ""}
        </small>
        <button
          type="button"
          className="icon-button"
          aria-label={`Remove ${item.name}`}
          onClick={onRemove}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {item.kind === "pdf" ? (
        <p className="attached-hint">
          Reviewers will see every page and can pin spots on them.
        </p>
      ) : item.kind === "image" ? (
        <div
          className={`canvas-frame ${placing ? "is-placing" : ""}`}
          onClick={place}
        >
          {url && <img src={url} alt={item.alt || "Your attached photo"} />}
          {item.pins.map((pin, index) => (
            <span
              key={pin.id}
              className="pin"
              style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
            >
              {index + 1}
            </span>
          ))}
        </div>
      ) : (
        url && (
          <video
            ref={video}
            src={url}
            controls
            playsInline
            className="attached-video"
          />
        )
      )}
      <label className="attached-field">
        <span>Describe it for someone who can’t see it</span>
        <input
          value={item.alt}
          maxLength={300}
          placeholder={
            item.kind === "image"
              ? "A breadboard where the LED never lights"
              : "What the video shows"
          }
          onChange={(event) => onChange({ alt: event.target.value })}
          aria-invalid={!item.alt.trim()}
        />
      </label>
      {item.kind === "pdf" ? null : item.kind === "image" ? (
        <div className="attached-marks">
          <button
            type="button"
            className={`button button-outline ${placing ? "is-active" : ""}`}
            aria-pressed={placing}
            onClick={() => setPlacing(!placing)}
          >
            <Crosshair size={14} />{" "}
            {placing ? "Click the spot on the photo" : "Pin what went wrong"}
          </button>
          {item.pins.map((pin, index) => (
            <label key={pin.id} className="mark-row">
              <span className="pin pin-static">{index + 1}</span>
              <input
                value={pin.label}
                placeholder="What’s happening here?"
                aria-label={`Label for pin ${index + 1}`}
                onChange={(event) =>
                  onChange({
                    pins: item.pins.map((p) =>
                      p.id === pin.id ? { ...p, label: event.target.value } : p,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove pin ${index + 1}`}
                onClick={() =>
                  onChange({ pins: item.pins.filter((p) => p.id !== pin.id) })
                }
              >
                <Trash2 size={13} />
              </button>
            </label>
          ))}
        </div>
      ) : (
        <div className="attached-marks">
          <button
            type="button"
            className="button button-outline"
            onClick={() => {
              const at = video.current?.currentTime ?? 0;
              onChange({
                moments: [
                  ...item.moments,
                  { at, label: "", kind: "broke" as const },
                ].sort((a, b) => a.at - b.at),
              });
            }}
          >
            <Crosshair size={14} /> Mark this moment
          </button>
          <span className="attached-hint">
            Pause where it went wrong, then mark it.
          </span>
          {item.moments.map((moment, index) => (
            <div key={`${moment.at}-${index}`} className="mark-row">
              <span className="moment-time">{clock(moment.at)}</span>
              <select
                aria-label={`Kind of moment at ${clock(moment.at)}`}
                value={moment.kind}
                onChange={(event) =>
                  onChange({
                    moments: item.moments.map((m, i) =>
                      i === index
                        ? { ...m, kind: event.target.value as Moment["kind"] }
                        : m,
                    ),
                  })
                }
              >
                <option value="broke">Where it broke</option>
                <option value="worked">Where it worked</option>
                <option value="note">Note</option>
              </select>
              <input
                value={moment.label}
                placeholder="What happens here?"
                aria-label={`Label for the moment at ${clock(moment.at)}`}
                onChange={(event) =>
                  onChange({
                    moments: item.moments.map((m, i) =>
                      i === index ? { ...m, label: event.target.value } : m,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove the moment at ${clock(moment.at)}`}
                onClick={() =>
                  onChange({
                    moments: item.moments.filter((_, i) => i !== index),
                  })
                }
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
