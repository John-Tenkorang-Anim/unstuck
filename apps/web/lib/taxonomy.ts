/**
 * Categories are open: anyone can create one or join others. These helpers keep
 * names tidy and give each one a stable address.
 */
export const categorySlug = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

/** Trim, collapse spaces, cap the length, and capitalise the first letter. */
export function categoryName(value: unknown) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}
