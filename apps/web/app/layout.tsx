import type { Metadata, Viewport } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/fraunces";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Unstuck — A little wiser, together.",
    template: "%s · Unstuck",
  },
  description:
    "What worked. What didn’t. And everything we learned. An open notebook of experiences to help you find your next way forward.",
  applicationName: "Unstuck",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f8f2",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
