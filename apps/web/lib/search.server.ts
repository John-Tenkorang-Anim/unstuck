import "server-only";
import { getNotebook } from "./api";
import { examples } from "./data";
import { entryDoc, sessionDoc, type Doc } from "./search";
import { sampleSessions } from "./sessions";
import type { Entry } from "./types";

/**
 * The searchable corpus. Sample mode indexes the full sample entries and
 * sessions. Live mode indexes what the public feed returns; full-text, video
 * and session search there waits on the API's hybrid search (spec section 11).
 */
export async function getCorpus(): Promise<{ docs: Doc[]; mode: string }> {
  const notebook = await getNotebook();
  if (notebook.mode === "examples")
    return {
      docs: [...examples.map(entryDoc), ...sampleSessions.map(sessionDoc)],
      mode: "examples",
    };
  return {
    docs: notebook.entries.map((entry) =>
      entryDoc({ ...entry, sections: [], context: {}, evidence: [] } as Entry),
    ),
    mode: notebook.mode,
  };
}
