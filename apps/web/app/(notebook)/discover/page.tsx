import type { Metadata } from "next";
import { HomeSearch } from "@/components/home-search";

export const metadata: Metadata = { title: "Discover" };

/**
 * The first page is one question: what are you stuck on? Search shows what
 * others tried, as you type and after you search. Ask posts it. Everything
 * else waits until it is useful.
 */
export default function Discover() {
  return (
    <section className="home" aria-labelledby="hero-title">
      <h1 id="hero-title">
        Learn from <span className="tint-brand">what failed.</span>
      </h1>
      <p>Search what others tried. If nobody has, ask.</p>
      <HomeSearch />
    </section>
  );
}
