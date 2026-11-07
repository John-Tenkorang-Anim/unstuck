import { Image as ImageIcon, Video } from "lucide-react";
import type { Attachment } from "@/lib/types";
import { ResponsiveImage } from "./responsive-image";
import { AccessibleVideo } from "./accessible-video";
export function MediaGallery({
  attachments,
  origin = "",
}: {
  attachments: Attachment[];
  origin?: string;
}) {
  if (!attachments.length) return null;
  return (
    <section
      className="media-gallery"
      aria-label="Photos and videos from this field note"
    >
      <h2 className="section-kicker">A closer look</h2>
      {attachments.map((attachment) => {
        if (attachment.state === "ready" && attachment.manifest)
          return attachment.manifest.kind === "image" ? (
            <ResponsiveImage
              key={attachment.id}
              media={attachment.manifest}
              origin={origin}
            />
          ) : (
            <AccessibleVideo
              key={attachment.id}
              media={attachment.manifest}
              origin={origin}
            />
          );
        return (
          <div key={attachment.id} className="media-unavailable">
            {attachment.kind === "image" ? (
              <ImageIcon size={21} />
            ) : (
              <Video size={21} />
            )}
            <p>
              {attachment.state === "processing"
                ? "This attachment is being prepared or reviewed."
                : "This attachment isn’t available."}{" "}
              <span>You can still read the field note.</span>
            </p>
          </div>
        );
      })}
    </section>
  );
}
