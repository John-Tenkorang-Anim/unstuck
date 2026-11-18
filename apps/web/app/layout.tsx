import type { Metadata, Viewport } from "next";
import "@fontsource-variable/source-sans-3/wght.css";
import { getReadingPolicy } from "@/lib/media/reading-policy.server";
import "./globals.css";
import "./styles/discovery.css";

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
 * Runs before first paint so a saved theme never flashes, with the selected reading mode.
 *
 * It also guards view transitions. When a tab is hidden (a background tab, or
 * a reload during development) the browser skips the animation and rejects the
 * transition's promises with InvalidStateError or AbortError. The page still
 * updates; only the animation is dropped. Those expected rejections are marked
 * handled here, and any other error is rethrown so real bugs stay visible.
 *
 * React ignores the hidden-document rejection only when its message matches
 * exactly. Newer Chrome appends a reason ("… invalid state. Document hidden"),
 * so React reported it as an error. The promises React reads are mapped back to
 * the message it recognises; the transition object is otherwise unchanged.
 */
const bootstrap = `try{var d=document.documentElement,t=localStorage.getItem("unstuck:theme");if(t==="light"||t==="dark")d.dataset.theme=t;var c=navigator.connection;if(/unstuck-reading=lite/.test(document.cookie)||(!/unstuck-reading=full/.test(document.cookie)&&c&&c.saveData))d.dataset.lite="true"}catch(e){}
try{var o=document.startViewTransition;if(o){var k="Transition was aborted because of invalid state",fix=function(p){if(!p)return p;var q=p.catch(function(e){if(e&&e.name==="InvalidStateError"&&typeof e.message==="string"&&e.message!==k&&e.message.indexOf(k)===0)throw new DOMException(k,"InvalidStateError");throw e});q.catch(function(){});return q};document.startViewTransition=function(){var v=o.apply(document,arguments);[v.ready,v.finished,v.updateCallbackDone].forEach(function(p){p&&p.catch(function(e){if(!e||(e.name!=="InvalidStateError"&&e.name!=="AbortError"))setTimeout(function(){throw e})})});if(typeof Proxy!=="function")return v;var m={ready:fix(v.ready),finished:fix(v.finished),updateCallbackDone:fix(v.updateCallbackDone)};return new Proxy(v,{get:function(t,n){if(Object.prototype.hasOwnProperty.call(m,n))return m[n];var x=t[n];return typeof x==="function"?x.bind(t):x}})}}}catch(e){}`;
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reading = await getReadingPolicy();
  return (
    <html
      data-lite={reading.lite ? "true" : undefined}
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
