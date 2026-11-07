import type { Topic } from "./types";

/**
 * How knowledge is organised for retrieval. Every entry and session sits in one
 * field and, optionally, one specialty. Professions map to specialties so a
 * welder, a nurse or a data engineer can follow exactly the slice they work in.
 * Profession groups follow the ILO's ISCO-08 major groups, so new occupations
 * slot in as data rather than code.
 */
export interface Field {
  name: Topic;
  slug: string;
  summary: string;
  specialties: { name: string; professions: string[] }[];
}
export const fields: Field[] = [
  {
    name: "Food & farming",
    slug: "food-farming",
    summary: "Growing, storing, cooking and selling food.",
    specialties: [
      { name: "Crops & soil", professions: ["Farmer", "Agronomist"] },
      { name: "Storage & cold chain", professions: ["Food technologist"] },
      { name: "Livestock", professions: ["Herder", "Veterinary technician"] },
    ],
  },
  {
    name: "Making & fixing",
    slug: "making-fixing",
    summary: "Building, repairing and engineering physical things.",
    specialties: [
      { name: "Structures", professions: ["Civil engineer", "Builder"] },
      { name: "Electronics", professions: ["Electrician", "Technician"] },
      { name: "Fabrication", professions: ["Welder", "Machinist", "Maker"] },
      { name: "Repair", professions: ["Mechanic", "Carpenter"] },
    ],
  },
  {
    name: "Software",
    slug: "software",
    summary: "Code, systems, data and the infrastructure under them.",
    specialties: [
      { name: "Web & apps", professions: ["Software engineer"] },
      { name: "Data & ML", professions: ["Data engineer", "ML engineer"] },
      { name: "Operations", professions: ["Site reliability engineer"] },
    ],
  },
  {
    name: "Everyday life",
    slug: "everyday-life",
    summary: "Home, money, health habits and getting things done.",
    specialties: [
      { name: "Home & energy", professions: ["Homeowner", "Renter"] },
      { name: "Money", professions: ["Small business owner"] },
    ],
  },
  {
    name: "Research",
    slug: "research",
    summary: "Experiments, studies and results that didn't replicate.",
    specialties: [
      { name: "Lab & bench", professions: ["Researcher", "Lab technician"] },
      { name: "Teaching & coursework", professions: ["Student", "Teacher"] },
      { name: "Field studies", professions: ["Field scientist"] },
    ],
  },
  {
    name: "Community",
    slug: "community",
    summary: "Groups, schools, organising and public projects.",
    specialties: [
      { name: "Education", professions: ["Teacher", "Organiser"] },
      { name: "Local projects", professions: ["Volunteer", "NGO staff"] },
    ],
  },
];
export const fieldBySlug = (slug: string) =>
  fields.find((field) => field.slug === slug);
export const fieldByName = (name: string) =>
  fields.find((field) => field.name === name);
