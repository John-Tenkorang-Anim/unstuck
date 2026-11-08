"use client";
import { Code2, Plus, Sigma, Table2, Trash2 } from "lucide-react";
import type { Block } from "@/lib/sessions";
import { parseCsv } from "./work-blocks";
import { MathInput } from "./math-input";

/** Compose shown working: maths steps, code with its output, or a data table. */
export function WorkingEditor({
  value,
  onChange,
}: {
  value: Block[];
  onChange: (next: Block[]) => void;
}) {
  const update = (index: number, block: Block) =>
    onChange(value.map((b, i) => (i === index ? block : b)));
  const remove = (index: number) =>
    onChange(value.filter((_, i) => i !== index));
  return (
    <div className="working-editor">
      <div className="working-add">
        <p className="dropzone-title">Show your working</p>
        <p className="dropzone-limits">
          Reviewers can point at a single step, line or row.
        </p>
        <div className="working-buttons">
          <button
            type="button"
            className="button button-outline"
            onClick={() =>
              onChange([
                ...value,
                { kind: "steps", title: "My working", steps: [""] },
              ])
            }
          >
            <Sigma size={15} /> Steps with maths
          </button>
          <button
            type="button"
            className="button button-outline"
            onClick={() =>
              onChange([
                ...value,
                {
                  kind: "code",
                  title: "main.py",
                  language: "Python",
                  code: "",
                  output: "",
                  expected: "",
                },
              ])
            }
          >
            <Code2 size={15} /> Code and output
          </button>
          <button
            type="button"
            className="button button-outline"
            onClick={() =>
              onChange([
                ...value,
                { kind: "data", title: "Measurements", csv: "" },
              ])
            }
          >
            <Table2 size={15} /> Data table
          </button>
        </div>
      </div>
      {value.map((block, index) => (
        <div key={index} className="attached">
          <div className="attached-head">
            {block.kind === "steps" ? (
              <Sigma size={15} />
            ) : block.kind === "code" ? (
              <Code2 size={15} />
            ) : (
              <Table2 size={15} />
            )}
            <input
              className="working-title"
              aria-label="Block title"
              value={block.title}
              onChange={(e) =>
                update(index, { ...block, title: e.target.value })
              }
            />
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove ${block.title}`}
              onClick={() => remove(index)}
            >
              <Trash2 size={14} />
            </button>
          </div>
          {block.kind === "steps" && (
            <ol className="step-editor">
              {block.steps.map((step, i) => (
                <li key={i}>
                  <span className="step-no" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div>
                    <MathInput
                      rows={2}
                      aria-label={`Step ${i + 1}`}
                      value={step}
                      placeholder={
                        i === 0
                          ? "Use Σ for symbols, or write maths between $ signs, like $\\int x \\sin x \\, dx$"
                          : "Next step"
                      }
                      onValue={(value) =>
                        update(index, {
                          ...block,
                          steps: block.steps.map((s, j) =>
                            j === i ? value : s,
                          ),
                        })
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove step ${i + 1}`}
                    onClick={() =>
                      update(index, {
                        ...block,
                        steps: block.steps.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    update(index, { ...block, steps: [...block.steps, ""] })
                  }
                >
                  <Plus size={14} /> Add a step
                </button>
              </li>
            </ol>
          )}
          {block.kind === "code" && (
            <div className="code-editor">
              <label className="attached-field">
                <span>Language</span>
                <input
                  value={block.language}
                  onChange={(e) =>
                    update(index, { ...block, language: e.target.value })
                  }
                />
              </label>
              <label className="attached-field">
                <span>Code</span>
                <textarea
                  className="mono"
                  rows={8}
                  spellCheck={false}
                  value={block.code}
                  placeholder="Paste the smallest piece of code that shows the problem."
                  onChange={(e) =>
                    update(index, { ...block, code: e.target.value })
                  }
                />
              </label>
              <div className="form-row">
                <label className="attached-field">
                  <span>What it printed or the error</span>
                  <textarea
                    className="mono"
                    rows={3}
                    spellCheck={false}
                    value={block.output ?? ""}
                    onChange={(e) =>
                      update(index, { ...block, output: e.target.value })
                    }
                  />
                </label>
                <label className="attached-field">
                  <span>What you expected</span>
                  <textarea
                    className="mono"
                    rows={3}
                    spellCheck={false}
                    value={block.expected ?? ""}
                    onChange={(e) =>
                      update(index, { ...block, expected: e.target.value })
                    }
                  />
                </label>
              </div>
            </div>
          )}
          {block.kind === "data" && (
            <div className="code-editor">
              <label className="attached-field">
                <span>Paste from a spreadsheet or CSV, with a header row</span>
                <textarea
                  className="mono"
                  rows={6}
                  spellCheck={false}
                  value={block.csv}
                  placeholder={"Length (m),Period (s)\n0.50,1.42\n0.75,1.74"}
                  onChange={(e) =>
                    update(index, {
                      ...block,
                      csv: e.target.value.replace(/\t/g, ","),
                    })
                  }
                />
              </label>
              {block.csv.trim().includes("\n") && (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {parseCsv(block.csv).header.map((cell, i) => (
                          <th key={i} scope="col">
                            {cell}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parseCsv(block.csv).rows.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
export const hasWorking = (blocks: Block[]) =>
  blocks.some((b) =>
    b.kind === "steps"
      ? b.steps.some((s) => s.trim())
      : b.kind === "code"
        ? !!b.code.trim()
        : !!b.csv.trim(),
  );
