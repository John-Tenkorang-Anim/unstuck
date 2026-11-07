import { assertSameOrigin, failure, requireAccount } from "@/lib/auth.server";
import { parseCsv } from "@/lib/csv";
import { loadSession } from "@/lib/shared.server";
import { noteTypes, type NoteType, type Pin } from "@/lib/sessions";
import {
  clean,
  cleanPin,
  insertNote,
  newId,
  rateLimit,
  StoreError,
  type StoredNote,
} from "@/lib/store.server";

export const dynamic = "force-dynamic";

/** Add a note. It may point at an existing anchor or bring a new pin with it. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    await rateLimit("note", account.id);
    const { id } = await params;
    const loaded = await loadSession(id, account);
    if (!loaded || loaded.hidden)
      throw new StoreError("Session not found.", 404);
    const { session } = loaded;
    const input = (await request.json()) as Record<string, unknown>;
    const type = input.type as NoteType;
    if (!noteTypes[session.kind].includes(type))
      throw new StoreError("Choose a kind of note.");
    const note: StoredNote = {
      id: newId(),
      sessionId: id,
      owner: account.id,
      created: new Date().toISOString(),
      alias: account.name,
      role: account.role,
      type,
      body: clean.text(input.body, 3, 4000, "Your note"),
    };
    const anchor = typeof input.anchor === "string" ? input.anchor : "whole";
    const [kind, value] = anchor.split(":");
    const n = Number(value);
    const steps =
      session.blocks?.flatMap((b) => (b.kind === "steps" ? b.steps : [])) ?? [];
    const lines =
      session.blocks?.flatMap((b) =>
        b.kind === "code" ? b.code.split("\n") : [],
      ) ?? [];
    const rows =
      session.blocks?.flatMap((b) =>
        b.kind === "data" ? parseCsv(b.csv).rows : [],
      ) ?? [];
    let pin: Pin | undefined;
    if (input.pin) {
      if (!session.work && !session.pdf)
        throw new StoreError("Pins need a photo or PDF.");
      pin = cleanPin(input.pin, `u-${newId().slice(0, 13)}`);
      note.pin = pin.id;
    } else if (kind === "pin" && session.pins.some((p) => p.id === value))
      note.pin = value;
    else if (kind === "step" && n >= 1 && n <= steps.length) note.step = n;
    else if (kind === "line" && n >= 1 && n <= lines.length) note.line = n;
    else if (kind === "row" && n >= 1 && n <= rows.length) note.row = n;
    else if (
      kind === "page" &&
      session.pdf &&
      Number.isInteger(n) &&
      n >= 1 &&
      n <= 500
    )
      note.page = n;
    else if (kind === "t" && n >= 0 && n <= 3600) note.at = n;
    else if (anchor !== "whole")
      throw new StoreError("That part of the work doesn’t exist.");
    await insertNote(note, pin);
    const { sessionId: _s, owner: _o, created: _c, ...shown } = note;
    return Response.json(
      {
        note: { ...shown, by: account.id, role: account.role || "Member" },
        pin,
      },
      { status: 201 },
    );
  } catch (error) {
    return failure(error);
  }
}
