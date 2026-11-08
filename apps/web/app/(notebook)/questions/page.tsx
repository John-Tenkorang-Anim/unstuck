import { redirect } from "next/navigation";

/**
 * Questions and search are one place now: people search first, and open
 * questions are a tab of the same results. Old links keep their filters.
 */
export default async function Questions({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = new URLSearchParams({ type: "questions" });
  for (const key of ["q", "show", "where", "page"]) {
    const value = params[key];
    if (typeof value === "string" && value) next.set(key, value);
  }
  redirect(`/search?${next}`);
}
