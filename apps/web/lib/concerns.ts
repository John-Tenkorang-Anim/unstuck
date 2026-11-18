export const concernTopics = [
  "Water & sanitation",
  "Roads & transport",
  "Environment",
  "Education",
  "Health & wellbeing",
  "Safety",
  "Housing",
  "Community services",
  "Other",
] as const;
export type ConcernStatus =
  "open" | "acknowledged" | "in_progress" | "resolved";
export const concernStatus: Record<ConcernStatus, string> = {
  open: "Awaiting response",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  resolved: "Resolved",
};
export const concernTone: Record<ConcernStatus, string> = {
  open: "open",
  acknowledged: "ongoing",
  in_progress: "mixed",
  resolved: "worked",
};
export const eventLabel = {
  raised: "Concern raised",
  note: "Community contribution",
  evidence: "Evidence added",
  response: "Response recorded",
  progress: "Progress update",
  status: "Status changed",
  commitment: "Commitment recorded",
  completion: "Completion recorded",
} as const;
export type ConcernEventKind = keyof typeof eventLabel;
export interface Concern {
  id: string;
  workspace: string;
  workspaceTitle: string;
  number: number;
  title: string;
  body: string;
  place: string;
  topic: string;
  requestedAction: string;
  status: ConcernStatus;
  version: number;
  author: string;
  authorHandle: string;
  supporters: number;
  supporting: boolean;
  responses: number;
  overdue: number;
  created: string;
  updated: string;
}
export interface ConcernEvent {
  id: string;
  sequence: string;
  kind: ConcernEventKind;
  body: string;
  author: string;
  authorHandle: string;
  created: string;
  data: {
    source?: string;
    organization?: string;
    mode?: "direct" | "recorded";
    from?: ConcernStatus;
    to?: ConcernStatus;
    commitment?: string;
    responsible?: string;
    due?: string;
  };
}
export interface Commitment {
  id: string;
  title: string;
  responsible: string;
  due: string;
  completed?: string;
  canComplete: boolean;
}
export const concernReference = (number: number) =>
  `C${String(number).padStart(4, "0")}`;
export const concernHref = (c: Pick<Concern, "workspace" | "id">) =>
  `/workspaces/${c.workspace}/concerns/${c.id}`;
export function isOverdue(
  due: string,
  today = new Date().toISOString().slice(0, 10),
) {
  return due < today;
}
export function validDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return undefined;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : undefined;
}
