"use client";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Fragment } from "react";
import type { Block } from "@/lib/sessions";

/** Text with inline maths between $…$, typeset with MathML for screen readers. */
export function MathText({ text }: { text: string }) {
  const parts = text.split(/(\$[^$]+\$)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.length > 2 && part.startsWith("$") && part.endsWith("$") ? (
          <span
            key={i}
            className="math"
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(part.slice(1, -1), {
                throwOnError: false,
                output: "htmlAndMathml",
              }),
            }}
          />
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
export function parseCsv(csv: string) {
  const [head = "", ...rows] = csv.trim().split(/\r?\n/);
  return {
    header: head.split(",").map((cell) => cell.trim()),
    rows: rows.map((row) => row.split(",").map((cell) => cell.trim())),
  };
}

/**
 * Shown working, with every step, code line and data row addressable. Pressing
 * one focuses its feedback and lets the next note attach to it.
 */
export function WorkBlocks({
  blocks,
  focus,
  counts,
  onAnchor,
}: {
  blocks: Block[];
  focus: string | null;
  counts: Record<string, number>;
  onAnchor: (key: string) => void;
}) {
  const badge = (key: string) =>
    counts[key] ? (
      <span className="anchor-count">
        {counts[key]}
        <span className="sr-only"> notes</span>
      </span>
    ) : null;
  return (
    <div className="work">
      {blocks.map((block, index) => (
        <section key={index} className={`work-block work-${block.kind}`}>
          <h2 className="work-title">
            {block.title}
            {block.kind === "code" && <span>{block.language}</span>}
          </h2>
          {block.kind === "steps" && (
            <ol className="steps">
              {block.steps.map((step, i) => {
                const key = `step:${i + 1}`;
                return (
                  <li key={key} className={focus === key ? "is-focus" : ""}>
                    <button
                      className="step-no"
                      aria-pressed={focus === key}
                      aria-label={`Step ${i + 1}, ${counts[key] ?? 0} notes`}
                      onClick={() => onAnchor(key)}
                    >
                      {i + 1}
                    </button>
                    <p>
                      <MathText text={step} />
                    </p>
                    {badge(key)}
                  </li>
                );
              })}
            </ol>
          )}
          {block.kind === "code" && (
            <>
              <div className="code" role="group" aria-label={block.title}>
                {block.code.split("\n").map((line, i) => {
                  const key = `line:${i + 1}`;
                  return (
                    <div
                      key={key}
                      className={`code-line ${focus === key ? "is-focus" : ""}`}
                    >
                      <button
                        className="line-no"
                        aria-pressed={focus === key}
                        aria-label={`Line ${i + 1}, ${counts[key] ?? 0} notes`}
                        onClick={() => onAnchor(key)}
                      >
                        {i + 1}
                      </button>
                      <code>{line || " "}</code>
                      {badge(key)}
                    </div>
                  );
                })}
              </div>
              {(block.output || block.expected) && (
                <dl className="code-io">
                  {block.output !== undefined && (
                    <div className="io-got">
                      <dt>Output</dt>
                      <dd>
                        <code>{block.output}</code>
                      </dd>
                    </div>
                  )}
                  {block.expected !== undefined && (
                    <div className="io-want">
                      <dt>Expected</dt>
                      <dd>
                        <code>{block.expected}</code>
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </>
          )}
          {block.kind === "data" && (
            <>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="sr-only">Row</span>
                      </th>
                      {parseCsv(block.csv).header.map((cell) => (
                        <th key={cell} scope="col">
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parseCsv(block.csv).rows.map((row, i) => {
                      const key = `row:${i + 1}`;
                      return (
                        <tr
                          key={key}
                          className={focus === key ? "is-focus" : ""}
                        >
                          <th scope="row">
                            <button
                              className="row-no"
                              aria-pressed={focus === key}
                              aria-label={`Row ${i + 1}, ${counts[key] ?? 0} notes`}
                              onClick={() => onAnchor(key)}
                            >
                              {i + 1}
                            </button>
                            {badge(key)}
                          </th>
                          {row.map((cell, j) => (
                            <td key={j}>{cell}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {block.note && <p className="data-note">{block.note}</p>}
            </>
          )}
        </section>
      ))}
    </div>
  );
}
