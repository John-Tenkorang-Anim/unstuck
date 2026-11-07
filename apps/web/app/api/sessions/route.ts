import { assertSameOrigin, failure, requireAccount } from "@/lib/auth.server";
import {
  clean,
  cleanBlocks,
  cleanMoments,
  cleanPins,
  insertSession,
  newId,
  rateLimit,
  saveFile,
  StoreError,
  type SharedSession,
} from "@/lib/store.server";
import { fields } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

/** Publish a critique session: the brief, optional working, and one work file. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    await rateLimit("session", account.id);
    const form = await request.formData();
    const input = JSON.parse(String(form.get("session") ?? "{}")) as Record<
      string,
      unknown
    >;
    const field = fields.find((f) => f.name === input.field);
    if (!field) throw new StoreError("Choose a field.");
    const specialty = field.specialties.find((s) => s.name === input.specialty);
    if (!specialty) throw new StoreError("Choose a specialty in that field.");
    const blocks = cleanBlocks(input.blocks);
    const title = clean.text(input.title, 6, 140, "The title");
    const wentWrong = clean.text(input.wentWrong, 3, 2000, "What went wrong");
    const ask = clean.text(input.ask, 3, 2000, "What feedback would help");
    const upload = form.get("work");
    let media: SharedSession["media"];
    if (upload instanceof File && upload.size) {
      const alt = clean.text(input.alt, 3, 300, "The description of your work");
      const { file, kind } = await saveFile(
        account.id,
        upload.name,
        Buffer.from(await upload.arrayBuffer()),
      );
      const width = Number(input.width),
        height = Number(input.height),
        duration = Number(input.duration);
      media = {
        kind,
        file: file.id,
        alt,
        ...(kind === "image" && width > 0 && height > 0
          ? { width: Math.round(width), height: Math.round(height) }
          : {}),
        ...(kind === "video"
          ? {
              moments: cleanMoments(input.moments),
              duration: duration > 0 && duration < 3600 ? duration : undefined,
            }
          : {}),
      };
    }
    if (!media && !blocks.length)
      throw new StoreError("Add a photo, video, PDF or your working.");
    const session: SharedSession = {
      id: newId(),
      kind: "critique",
      owner: account.id,
      created: new Date().toISOString(),
      opened: new Date().toISOString().slice(0, 10),
      title,
      field: field.name,
      specialty: specialty.name,
      level:
        typeof input.level === "string"
          ? input.level.trim().slice(0, 80) || undefined
          : undefined,
      course:
        typeof input.course === "string"
          ? input.course.trim().slice(0, 120) || undefined
          : undefined,
      mode: input.mode === "hints" ? "hints" : "full",
      status: "open",
      wentWrong,
      ask,
      pins: media?.kind === "image" ? cleanPins(input.pins) : [],
      blocks: blocks.length ? blocks : undefined,
      media,
      rounds: [{ n: 1, note: "First submission.", notes: [] }],
    };
    await insertSession(session);
    return Response.json({ id: session.id }, { status: 201 });
  } catch (error) {
    return failure(
      error instanceof SyntaxError
        ? new StoreError("That session couldn’t be read.")
        : error,
    );
  }
}
