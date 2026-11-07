export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { Discovery } from "@/components/discovery";
import { getNotebook } from "@/lib/api";
export const metadata: Metadata = { title: "Open questions" };
export default async function Questions() {
  return <Discovery notebook={await getNotebook()} questions />;
}
