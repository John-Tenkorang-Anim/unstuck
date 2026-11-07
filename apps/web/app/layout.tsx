import type { Metadata, Viewport } from "next";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/ibm-plex-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Unstuck — Everything the world has tried",
    template: "%s · Unstuck",
  },
  description:
    "What worked, what didn’t, and why. An open record of attempts, with the context and evidence behind each one.",
  applicationName: "Unstuck",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};
/**
 * Runs before first paint so a saved theme never flashes, and so light reading
 * never downloads the web fonts.
 */
const bootstrap = `try{var d=document.documentElement,t=localStorage.getItem("unstuck:theme");if(t==="light"||t==="dark")d.dataset.theme=t;var c=navigator.connection;if(/unstuck-reading=lite/.test(document.cookie)||(!/unstuck-reading=full/.test(document.cookie)&&c&&c.saveData))d.dataset.lite="true"}catch(e){}`;
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
