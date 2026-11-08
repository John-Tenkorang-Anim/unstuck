"use client";
import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type TextareaHTMLAttributes,
} from "react";
import { Sigma } from "lucide-react";
import { MathText } from "./work-blocks";

type Insert = { label: string; tex: string; title: string };
/** `□` marks where the cursor lands after inserting. */
const structures: Insert[] = [
  { label: "a⁄b", tex: "\\frac{□}{}", title: "Fraction" },
  { label: "x²", tex: "^{□}", title: "Power" },
  { label: "x₂", tex: "_{□}", title: "Subscript" },
  { label: "√", tex: "\\sqrt{□}", title: "Square root" },
  { label: "ⁿ√", tex: "\\sqrt[□]{}", title: "Nth root" },
  { label: "∫", tex: "\\int_{□}^{} \\, dx", title: "Integral" },
  { label: "∑", tex: "\\sum_{i=□}^{n}", title: "Sum" },
  { label: "lim", tex: "\\lim_{x \\to □}", title: "Limit" },
  { label: "d/dx", tex: "\\frac{d□}{dx}", title: "Derivative" },
  { label: "x̄", tex: "\\bar{□}", title: "Mean or bar" },
  { label: "v⃗", tex: "\\vec{□}", title: "Vector" },
  { label: "( )", tex: "\\left(□\\right)", title: "Brackets that grow" },
];
const symbols: Insert[] = (
  [
    ["π", "\\pi", "Pi"],
    ["θ", "\\theta", "Theta"],
    ["α", "\\alpha", "Alpha"],
    ["β", "\\beta", "Beta"],
    ["λ", "\\lambda", "Lambda"],
    ["μ", "\\mu", "Mu"],
    ["σ", "\\sigma", "Sigma"],
    ["ω", "\\omega", "Omega"],
    ["Δ", "\\Delta", "Delta"],
    ["Ω", "\\Omega", "Ohm"],
    ["±", "\\pm", "Plus or minus"],
    ["×", "\\times", "Times"],
    ["÷", "\\div", "Divide"],
    ["·", "\\cdot", "Dot"],
    ["≤", "\\le", "Less than or equal"],
    ["≥", "\\ge", "Greater than or equal"],
    ["≠", "\\ne", "Not equal"],
    ["≈", "\\approx", "Approximately"],
    ["∞", "\\infty", "Infinity"],
    ["→", "\\to", "Tends to"],
    ["⇒", "\\Rightarrow", "Implies"],
    ["°", "^\\circ", "Degrees"],
    ["∂", "\\partial", "Partial"],
    ["∈", "\\in", "In"],
  ] as const
).map(([label, tex, title]) => ({ label, tex, title }));

/** Is the caret inside $…$? Counts the dollar signs before it. */
function insideMath(text: string, at: number) {
  const before = text.slice(0, at).replace(/\\\$/g, "");
  return (before.match(/\$/g)?.length ?? 0) % 2 === 1;
}

export type MathInputHandle = { focus: () => void };

/**
 * A text box for work with maths in it. The palette inserts LaTeX between $
 * signs, ⌘/Ctrl+M starts an inline equation, and a live preview shows the
 * typeset result. Plain text works exactly as before.
 */
export const MathInput = forwardRef<
  MathInputHandle,
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
    value: string;
    onValue: (value: string) => void;
    onGrow?: (element: HTMLTextAreaElement) => void;
  }
>(function MathInput({ value, onValue, onGrow, onKeyDown, ...props }, ref) {
  const box = useRef<HTMLTextAreaElement>(null);
  const [palette, setPalette] = useState(false);
  useImperativeHandle(ref, () => ({ focus: () => box.current?.focus() }));
  // Place the caret after React has written the new text, or it jumps to the end.
  const caretAt = useRef<number | null>(null);
  useLayoutEffect(() => {
    const element = box.current;
    if (caretAt.current === null || !element) return;
    element.focus();
    element.setSelectionRange(caretAt.current, caretAt.current);
    caretAt.current = null;
    onGrow?.(element);
  }, [value, onGrow]);
  function insert(tex: string) {
    const element = box.current;
    if (!element) return;
    const { selectionStart: start, selectionEnd: end } = element;
    const selected = value.slice(start, end);
    // Structures put the caret in their first slot. A lone symbol puts it
    // after itself, outside the equation, so plain words stay plain.
    const inside = insideMath(value, start);
    let snippet = tex.includes("□")
      ? tex.replace("□", selected ? `${selected}□` : "□")
      : `${tex}${inside ? " " : ""}`;
    if (!inside) snippet = `$${snippet}$`;
    if (!snippet.includes("□")) snippet += "□";
    const caret = start + snippet.indexOf("□");
    caretAt.current = caret;
    onValue(
      value.slice(0, start) + snippet.replace("□", "") + value.slice(end),
    );
  }
  const hasMath = /\$[^$]+\$/.test(value);
  return (
    <div className="math-input">
      <div className="math-input-box">
        <textarea
          {...props}
          ref={box}
          value={value}
          onChange={(event) => {
            onValue(event.target.value);
            onGrow?.(event.target);
          }}
          onKeyDown={(event) => {
            if (
              event.key.toLowerCase() === "m" &&
              (event.metaKey || event.ctrlKey)
            ) {
              event.preventDefault();
              insert("□");
              return;
            }
            onKeyDown?.(event);
          }}
        />
        <button
          type="button"
          className={`math-toggle ${palette ? "is-on" : ""}`}
          aria-pressed={palette}
          aria-label="Maths symbols"
          title="Maths symbols (⌘M starts an equation)"
          onClick={() => setPalette(!palette)}
        >
          <Sigma size={15} aria-hidden="true" />
        </button>
      </div>
      {palette && (
        <div className="math-palette" role="toolbar" aria-label="Insert maths">
          {[structures, symbols].map((group, i) => (
            <div key={i} className="math-group">
              {group.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  title={item.title}
                  aria-label={item.title}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insert(item.tex)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
          <p className="math-help">
            Maths goes between $ signs, like <code>$v = u + at$</code>. Use{" "}
            <code>$$…$$</code> for an equation on its own line. ⌘M or Ctrl+M
            starts one.
          </p>
        </div>
      )}
      {hasMath && (
        <div className="math-preview">
          <span className="math-preview-label">Preview</span>
          <p>
            <MathText text={value} />
          </p>
        </div>
      )}
    </div>
  );
});
