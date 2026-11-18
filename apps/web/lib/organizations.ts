/**
 * Organisations — universities, businesses, nonprofits, community groups and
 * public bodies — organise their own problem-solving work here. They can keep
 * private workspaces and contribute selected knowledge to the public platform.
 * Authorship stays with people: being affiliated never hands an organisation
 * the credit or the rights to someone’s contribution.
 */
export type OrgKind =
  "community" | "nonprofit" | "university" | "research" | "business" | "public";
export const orgKindLabel: Record<OrgKind, string> = {
  community: "Community group",
  nonprofit: "Nonprofit",
  university: "University group",
  research: "Research organisation",
  business: "Business",
  public: "Public body",
};
export type OrgRole = "admin" | "member" | "guest";
export const orgRoleLabel: Record<OrgRole, string> = {
  admin: "Admin",
  member: "Member",
  guest: "Guest",
};
export const orgRoleHelp: Record<OrgRole, string> = {
  admin: "Manages members, permissions and what the organisation publishes",
  member:
    "Works in the organisation’s workspaces and represents it when they choose",
  guest: "Invited into specific workspaces only",
};
export interface OrgMember {
  name: string;
  role: OrgRole;
  title?: string;
}
export type ReportKind = "progress" | "findings" | "lessons";
export const reportKindLabel: Record<ReportKind, string> = {
  progress: "Progress summary",
  findings: "Research findings",
  lessons: "Published lessons",
};
export interface OrgReport {
  id: string;
  kind: ReportKind;
  title: string;
  date: string;
  summary: string;
  /** The records it reports on, by id. Reports never stand without them. */
  refs: string[];
}
export interface Organization {
  id: string;
  name: string;
  kind: OrgKind;
  tagline: string;
  about: string;
  place: string;
  founded?: string;
  website?: string;
  focus: string[];
  members: OrgMember[];
  /** Workspaces it hosts, and problems it works on. */
  workspaces: string[];
  problems: string[];
  /** Public contributions by its members that the organisation highlights. */
  featured: string[];
  reports: OrgReport[];
  /** What new workspaces default to, and whether members publish freely. */
  defaults: {
    visibility: "public" | "restricted" | "private";
    review: boolean;
  };
  sample?: boolean;
}

export const sampleOrganizations: Organization[] = [
  {
    id: "tamale-growers",
    name: "Tamale Growers Cooperative",
    kind: "community",
    tagline: "Smallholders sharing what works on a smallholder budget.",
    about:
      "A cooperative of 60 smallholder farms around Tamale. Members test low-cost storage and drainage ideas on a few rows first, then share what happened, including what didn’t work.",
    place: "Tamale, Ghana",
    founded: "2019",
    focus: ["Storage", "Drainage", "Soil health"],
    members: [
      { name: "rain-gauge-07", role: "admin", title: "Field coordinator" },
      { name: "breezy-tamarind-12", role: "member", title: "Farmer" },
      { name: "dry-season-04", role: "member", title: "Farmer" },
      { name: "quiet-baobab-24", role: "guest", title: "Extension officer" },
    ],
    workspaces: ["community-plastic-collection"],
    problems: ["food-spoilage-without-cold-chain", "crops-after-heavy-rain"],
    featured: [
      "two-pots-one-small-breakthrough",
      "maize-yellowing-after-first-rains",
    ],
    reports: [
      {
        id: "cooler-season-report",
        kind: "findings",
        title: "Clay-pot coolers through one dry and one humid week",
        date: "2026-11-04",
        summary:
          "Raising and wrapping the cooler added one to two days of firm tomatoes. Low confidence: one household, judged by touch.",
        refs: ["test-pots-raised", "sample-improvement-pots"],
      },
      {
        id: "rains-q4",
        kind: "progress",
        title: "After the first rains: what we’re testing",
        date: "2026-11-06",
        summary:
          "Drains between low rows and a nitrogen test strip are proposed. Photos every three days will tell nitrogen loss from disease.",
        refs: ["crops-after-heavy-rain", "sample-improvement-maize"],
      },
    ],
    defaults: { visibility: "public", review: false },
    sample: true,
  },
  {
    id: "kumasi-materials-lab",
    name: "Kumasi Materials Lab",
    kind: "university",
    tagline: "Low-cost materials that survive real conditions.",
    about:
      "A university research group working on coatings and biodegradation. We publish negative results with their measurements so other labs don’t repeat them.",
    place: "Kumasi, Ghana",
    founded: "2021",
    website: "https://example.org/kumasi-materials",
    focus: ["Coatings", "Biodegradation", "Scale-up"],
    members: [
      { name: "bench-notes-15", role: "admin", title: "Lab lead" },
      { name: "rooftop-lab-21", role: "member", title: "Materials engineer" },
      {
        name: "night-shift-lab-03",
        role: "member",
        title: "Research technician",
      },
      { name: "pilot-plant-08", role: "guest", title: "Partner lab" },
    ],
    workspaces: [],
    problems: ["plastic-biodegradation-scale-up", "solar-coatings-outdoors"],
    featured: [
      "microbial-biodegradation-failed-at-scale",
      "low-cost-solar-coating-failed-outdoors",
    ],
    reports: [
      {
        id: "scale-up-findings",
        kind: "findings",
        title: "Oxygen transfer and degradation at 10 L",
        date: "2026-11-13",
        summary:
          "With dissolved oxygen above 30%, mass loss recovered to about 85%. One run; aeration and substrate changed together.",
        refs: ["test-biodegradation-10l", "plastic-biodegradation-scale-up"],
      },
      {
        id: "coating-lessons",
        kind: "lessons",
        title: "Why lab coating gains vanish outdoors",
        date: "2026-11-05",
        summary:
          "Humidity and UV weren’t part of our indoor tests. We now age every coating outdoors for six weeks before reporting gains.",
        refs: [
          "lab-gains-vanish-outdoors",
          "low-cost-solar-coating-failed-outdoors",
        ],
      },
    ],
    defaults: { visibility: "restricted", review: true },
    sample: true,
  },
  {
    id: "accra-street-collective",
    name: "Accra Street Collective",
    kind: "nonprofit",
    tagline: "Neighbours fixing the everyday things together.",
    about:
      "A small nonprofit that helps residents organise around shared problems: drainage, crossings, waste collection. We host neighbourhood workspaces and keep a public record of every promise made to residents.",
    place: "Accra, Ghana",
    founded: "2023",
    focus: ["Neighbourhoods", "Public services", "Waste"],
    members: [
      { name: "Akua Mensah", role: "admin", title: "Organiser" },
      { name: "Kwame Boateng", role: "member", title: "Volunteer" },
      { name: "market-lane-02", role: "member", title: "Local business owner" },
    ],
    workspaces: ["market-road-neighbours", "asokwa-community"],
    problems: ["community-plastic-collection", "disputed-deliveries"],
    featured: ["small-business-delivery-losses"],
    reports: [
      {
        id: "market-road-q4",
        kind: "progress",
        title: "Market Road: two concerns, one overdue promise",
        date: "2026-11-07",
        summary:
          "The drain outlet inspection passed its date without a repair schedule. The school crossing still awaits a first response.",
        refs: ["market-road-neighbours"],
      },
    ],
    defaults: { visibility: "public", review: false },
    sample: true,
  },
];
export const organizationById = (id: string) =>
  sampleOrganizations.find((o) => o.id === id);
/** Which organisations host a workspace, for its header. */
export const hostsOf = (workspace: string) =>
  sampleOrganizations.filter((o) => o.workspaces.includes(workspace));
