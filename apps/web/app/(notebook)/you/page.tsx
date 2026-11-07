import { redirect } from "next/navigation";

/** Your posts now live in the notebook. */
export default async function YourPosts({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const show = params.show === "attention" ? "&show=attention" : "";
  redirect(`/notebook?tab=posts${show}`);
}
