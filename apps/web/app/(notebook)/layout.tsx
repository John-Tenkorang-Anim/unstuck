import { NotebookProvider } from "@/components/notebook-provider";
import { Shell } from "@/components/shell";
export default function NotebookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NotebookProvider>
      <Shell>{children}</Shell>
    </NotebookProvider>
  );
}
