import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Play, Search } from "lucide-react";
import { OutcomeGlyph } from "@/components/glyph";
import { getCorpus } from "@/lib/search.server";
import {
  clock,
  resultTypes,
  search,
  summarize,
  type Result,
  type ResultType,
} from "@/lib/search";
import { fieldBySlug, fields } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const q = (await searchParams).q;
  return { title: typeof q === "string" && q ? `${q} · Search` : "Search" };
}
const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";
const suggestions = [
  "bridge twisting",
  "cold solder joint",
  "clay pot cooler",
  "3D print failed",
  "cache key",
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = one(params.q).slice(0, 200);
  const type = (resultTypes.find((t) => t.key === one(params.type))?.key ??
    "all") as ResultType;
  const field = fieldBySlug(one(params.field));
  const { docs, mode } = await getCorpus();
  const { results, counts, fieldCounts } = search(docs, q, {
    type,
    field: field?.name,
  });
  const link = (change: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(q ? { q } : {}),
      ...(type !== "all" ? { type } : {}),
      ...(field ? { field: field.slug } : {}),
      ...change,
    });
    for (const [key, value] of [...next]) if (!value) next.delete(key);
    return `/search${next.size ? `?${next}` : ""}`;
  };
  const summary = summarize(results);
  const moments = q
    ? results
        .flatMap((r) =>
          r.matched
            .filter((a) => a.kind === "moment")
            .map((anchor) => ({ anchor, result: r })),
        )
        .slice(0, 6)
    : [];
  return (
    <div className="serp frame">
      <form className="serp-bar" action="/search" role="search">
        <Search size={20} aria-hidden="true" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Search everything"
          placeholder="What are you trying to figure out?"
          autoComplete="off"
        />
        {type !== "all" && <input type="hidden" name="type" value={type} />}
        {field && <input type="hidden" name="field" value={field.slug} />}
        <button className="button button-dark">Search</button>
      </form>
      <nav className="serp-tabs" aria-label="Result types">
        {resultTypes.map((t) => (
          <Link
            key={t.key}
            href={link({ type: t.key === "all" ? "" : t.key })}
            aria-current={type === t.key ? "page" : undefined}
          >
            {t.label}
            <span aria-hidden="true">{counts[t.key]}</span>
          </Link>
        ))}
      </nav>
      <div className="serp-fields" aria-label="Fields">
        <Link
          href={link({ field: "" })}
          aria-current={!field ? "true" : undefined}
        >
          Every field
        </Link>
        {fields.map((f) => (
          <Link
            key={f.slug}
            href={link({ field: f.slug })}
            aria-current={field?.slug === f.slug ? "true" : undefined}
          >
            {f.name}
            <span aria-hidden="true">{fieldCounts.get(f.name) ?? 0}</span>
          </Link>
        ))}
      </div>
      {mode === "examples" && (
        <p className="example-notice serp-notice">
          <span className="example-tag">Sample data</span> Searching fictional
          examples and one historical case. Photos and film are real and
          credited.
        </p>
      )}
      {!q && type === "all" && !field ? (
        <Directory counts={fieldCounts} />
      ) : (
        <div className="serp-grid">
          <div className="serp-main">
            <h1 className="serp-count">
              {results.length
                ? `${results.length} ${results.length === 1 ? "result" : "results"}${q ? ` for “${q}”` : ""}`
                : `Nothing found${q ? ` for “${q}”` : ""}`}
            </h1>
            {moments.length > 0 && (
              <section className="serp-moments" aria-labelledby="moments-title">
                <h2 id="moments-title">Moments in video</h2>
                <ul>
                  {moments.map(({ anchor, result }) => (
                    <li key={anchor.href}>
                      <Link href={anchor.href}>
                        <span className="serp-thumb">
                          {result.doc.picture && (
                            <img
                              src={result.doc.picture.small}
                              alt=""
                              loading="lazy"
                              width={result.doc.picture.width}
                              height={result.doc.picture.height}
                            />
                          )}
                          <span className="serp-time">
                            <Play size={11} /> {clock(anchor.at ?? 0)}
                          </span>
                        </span>
                        <strong>{anchor.text.split(". ")[0]}</strong>
                        <span>{result.doc.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {results.length ? (
              <ol className="serp-results">
                {results.map((result) => (
                  <ResultItem key={result.doc.id} result={result} />
                ))}
              </ol>
            ) : (
              <div className="serp-empty">
                <p>Try fewer words, another field, or one of these searches.</p>
                <Suggest />
                <Link className="button button-dark" href="/new?kind=problem">
                  Ask it as a question
                </Link>
              </div>
            )}
          </div>
          {summary.total > 0 && (
            <aside className="evidence" aria-labelledby="evidence-title">
              <h2 id="evidence-title">What the attempts say</h2>
              <p className="evidence-sub">
                Counted from {summary.total}{" "}
                {summary.total === 1 ? "matching entry" : "matching entries"}.
              </p>
              <div className="evidence-bar" aria-hidden="true">
                {summary.outcomes.map((o) => (
                  <span
                    key={o.key}
                    data-outcome={o.key}
                    style={{ flexGrow: o.count }}
                  />
                ))}
                {summary.open > 0 && (
                  <span
                    data-outcome="open"
                    style={{ flexGrow: summary.open }}
                  />
                )}
              </div>
              <ul className="evidence-counts">
                {summary.outcomes.map((o) => (
                  <li key={o.key} data-outcome={o.key}>
                    <OutcomeGlyph outcome={o.key} /> {o.label}
                    <b>{o.count}</b>
                  </li>
                ))}
                {summary.open > 0 && (
                  <li data-outcome="open">
                    <OutcomeGlyph outcome="open" /> No result yet
                    <b>{summary.open}</b>
                  </li>
                )}
              </ul>
              {summary.breaks.length > 0 && (
                <>
                  <h3>Where it broke</h3>
                  <ul className="evidence-list">
                    {summary.breaks.map(({ moment, doc }) => (
                      <li key={doc.id + moment.at}>
                        <Link
                          href={`${doc.href}?t=${Math.floor(moment.at)}#clip`}
                        >
                          <span className="moment-time">
                            {clock(moment.at)}
                          </span>
                          {moment.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {summary.explanations.length > 0 && (
                <>
                  <h3>Explanations on record</h3>
                  <ul className="evidence-list">
                    {summary.explanations.map((e) => (
                      <li key={e.doc.id + e.label} data-state={e.state}>
                        <Link href={`${e.doc.href}#why`}>
                          <span className="evidence-state">
                            <span className="evidence-dot" aria-hidden="true" />
                            {e.state}
                          </span>
                          {e.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
function ResultItem({ result }: { result: Result }) {
  const { doc } = result;
  const outcome = doc.source === "entry" ? (doc.outcome ?? "open") : null;
  return (
    <li className="result" data-outcome={outcome ?? undefined}>
      <div className="result-body">
        <p className="result-crumb">
          {outcome && <OutcomeGlyph outcome={outcome as never} size={12} />}
          {doc.field} › {doc.kindLabel} · {doc.place}
        </p>
        <h2>
          <Link href={doc.href}>{doc.title}</Link>
        </h2>
        <p className="result-snippet">
          {result.snippet.map((segment, i) =>
            segment.hit ? <mark key={i}>{segment.text}</mark> : segment.text,
          )}
        </p>
        {result.matched.length > 0 && (
          <ul className="result-anchors" aria-label="Matched in">
            {result.matched.map((anchor) => (
              <li key={anchor.href + anchor.label}>
                <Link href={anchor.href} data-anchor={anchor.kind}>
                  {anchor.kind === "moment" && (
                    <Play size={11} aria-hidden="true" />
                  )}
                  <b>{anchor.label}</b>
                  <span>
                    {anchor.text.slice(0, 70)}
                    {anchor.text.length > 70 ? "…" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="result-stats">
          {doc.source === "entry"
            ? `${doc.tried} tried · ${doc.helped} found it useful`
            : `${doc.helped} notes in this session`}
        </p>
      </div>
      {doc.picture && (
        <Link
          className="result-thumb"
          href={doc.href}
          tabIndex={-1}
          aria-hidden="true"
        >
          <img
            src={doc.picture.small}
            alt=""
            loading="lazy"
            width={doc.picture.width}
            height={doc.picture.height}
          />
          {doc.duration && (
            <span className="serp-time">
              <Play size={11} /> {clock(doc.duration)}
            </span>
          )}
        </Link>
      )}
    </li>
  );
}
function Suggest() {
  return (
    <ul className="suggest">
      {suggestions.map((s) => (
        <li key={s}>
          <Link href={`/search?q=${encodeURIComponent(s)}`}>{s}</Link>
        </li>
      ))}
    </ul>
  );
}
function Directory({ counts }: { counts: Map<string, number> }) {
  return (
    <section className="directory" aria-labelledby="directory-title">
      <p className="serp-count">Try a search</p>
      <Suggest />
      <h1 id="directory-title" className="directory-title">
        Browse by field
      </h1>
      <div className="directory-grid">
        {fields.map((f) => (
          <Link
            key={f.slug}
            className="directory-card"
            href={`/search?field=${f.slug}`}
          >
            <span className="directory-count">{counts.get(f.name) ?? 0}</span>
            <strong>
              {f.name} <ArrowUpRight size={15} />
            </strong>
            <span>{f.summary}</span>
            <span className="directory-specialties">
              {f.specialties.map((s) => s.name).join(" · ")}
            </span>
            <span className="directory-professions">
              {[...new Set(f.specialties.flatMap((s) => s.professions))]
                .slice(0, 4)
                .join(" · ")}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
