import "server-only";
import { getNotebook } from "./api";
import { examples } from "./data";
import { entryDoc, sessionDoc, type Doc } from "./search";
import { sampleSessions } from "./sessions";
import { listSharedSessions } from "./shared.server";
import { publishedEntries } from "./entries.server";
import type { Entry } from "./types";

/**
 * The searchable corpus. Sample mode indexes the full sample entries and
 * sessions. Live mode indexes what the public feed returns; full-text, video
 * and session search there waits on the API's hybrid search (spec section 11).
 */
export async function getCorpus(): Promise<{ docs: Doc[]; mode: string }> {
  const notebook = await getNotebook();
  const shared = [
    ...(await publishedEntries()).map(entryDoc),
    ...(await listSharedSessions()).map(sessionDoc),
  ];
  if (notebook.mode === "examples")
    return {
      docs: [
        ...examples.map(entryDoc),
        ...sampleSessions.map(sessionDoc),
        ...shared,
      ],
      mode: "examples",
    };
  return {
    docs: [
      ...notebook.entries
        .filter((entry) => !shared.some((doc) => doc.id === entry.id))
        .map((entry) =>
          entryDoc({
            ...entry,
            sections: [],
            context: {},
            evidence: [],
          } as Entry),
        ),
      ...shared,
    ],
    mode: notebook.mode,
  };
}
