import type { Metadata } from "next";
import { HomeSearch } from "@/components/home-search";
import { Sky } from "@/components/sky";
import { questionItems } from "@/lib/questions.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Discover" };

/**
 * The first page is one question: what are you stuck on? It is drawn as a
 * star chart whose bright stars are questions people asked. Search shows what
 * others tried, as you type and after you search. Ask posts it.
 */
export default async function Discover() {
  const questions = await questionItems({ show: "all", size: 7 })
    .then((r) => r.items)
    .catch(() => []);
  return (
    <section className="home" aria-labelledby="hero-title">
      <Sky questions={questions} />
      <div className="home-inner">
        <h1 id="hero-title">
          Learn from <span className="tint-brand">what failed.</span>
        </h1>
        <p>Search what others tried. If nobody has, ask.</p>
        <div className="home-orbit">
          <HomeSearch />
          <span className="comet" aria-hidden="true" />
        </div>
        {questions.length > 0 && (
          <p className="sky-key">
            <span className="sky-key-dot" aria-hidden="true" /> Every bright
            star is a question someone asked. Pink ones are still waiting.
          </p>
        )}
      </div>
    </section>
  );
}
