import type { Metadata } from "next";
import { SessionComposer } from "@/components/session-composer";
export const metadata: Metadata = { title: "Ask for critique" };
export default function NewSession() {
  return <SessionComposer />;
}
