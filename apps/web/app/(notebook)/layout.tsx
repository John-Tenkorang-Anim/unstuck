import { getReadingPolicy } from "@/lib/media/reading-policy.server";
import { NotebookProvider } from "@/components/notebook-provider";
import { Shell } from "@/components/shell";
export default async function NotebookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reading = await getReadingPolicy();
  return (
    <NotebookProvider initialLite={reading.lite} initialMode={reading.mode}>
      <Shell>{children}</Shell>
    </NotebookProvider>
  );
}
