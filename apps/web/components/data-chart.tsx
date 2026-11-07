"use client";
import { useMemo, useState } from "react";

/**
 * A scatter plot of two numeric columns, with an optional least-squares line.
 * Each point is a row, so the chart and the table share anchors: an odd point
 * and its row light up together. The table remains the accessible view.
 */
export function DataChart({
  header,
  rows,
  focus,
  onAnchor,
}: {
  header: string[];
  rows: string[][];
  focus: string | null;
  onAnchor: (key: string) => void;
}) {
  const numeric = header
    .map((name, i) => ({ name, i }))
    .filter(
      ({ i }) =>
        rows.length > 1 &&
        rows.every(
          (row) =>
            row[i] !== undefined &&
            row[i] !== "" &&
            Number.isFinite(Number(row[i])),
        ),
    );
  const [x, setX] = useState(numeric[0]?.i ?? 0);
  const [y, setY] = useState(numeric.at(-1)?.i ?? 1);
  const [fit, setFit] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const points = useMemo(
    () => rows.map((row, r) => ({ r, x: Number(row[x]), y: Number(row[y]) })),
    [rows, x, y],
  );
  if (numeric.length < 2) return null;
  const W = 560,
    H = 300,
    m = { l: 52, r: 16, t: 14, b: 40 };
  const span = (values: number[]) => {
    const lo = Math.min(...values),
      hi = Math.max(...values);
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.08;
    return [lo - pad, hi + pad];
  };
  const [x0, x1] = span(points.map((p) => p.x));
  const [y0, y1] = span(points.map((p) => p.y));
  const sx = (v: number) => m.l + ((v - x0) / (x1 - x0)) * (W - m.l - m.r);
  const sy = (v: number) => H - m.b - ((v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const ticks = (lo: number, hi: number) =>
    Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const format = (v: number) =>
    Math.abs(v) >= 100
      ? v.toFixed(0)
      : Math.abs(v) >= 10
        ? v.toFixed(1)
        : v.toFixed(2);
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n,
    my = points.reduce((s, p) => s + p.y, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const slope = sxx
    ? points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx
    : 0;
  const intercept = my - slope * mx;
  const ssTot = points.reduce((s, p) => s + (p.y - my) ** 2, 0);
  const r2 = ssTot
    ? 1 -
      points.reduce((s, p) => s + (p.y - (intercept + slope * p.x)) ** 2, 0) /
        ssTot
    : 1;
  const hovered = hover === null ? null : points[hover];
  return (
    <figure className="chart">
      <div className="chart-controls">
        <label>
          <span>Across</span>
          <select value={x} onChange={(e) => setX(Number(e.target.value))}>
            {numeric.map((c) => (
              <option key={c.i} value={c.i}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Up</span>
          <select value={y} onChange={(e) => setY(Number(e.target.value))}>
            {numeric.map((c) => (
              <option key={c.i} value={c.i}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="chart-fit">
          <input
            type="checkbox"
            checked={fit}
            onChange={(e) => setFit(e.target.checked)}
          />{" "}
          Best-fit line
        </label>
      </div>
      <div className="chart-frame">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${header[y]} against ${header[x]}, ${n} points. The table above lists every value.`}
        >
          {ticks(y0, y1).map((t) => (
            <g key={`y${t}`}>
              <line
                x1={m.l}
                x2={W - m.r}
                y1={sy(t)}
                y2={sy(t)}
                className="chart-grid"
              />
              <text
                x={m.l - 8}
                y={sy(t) + 4}
                textAnchor="end"
                className="chart-tick"
              >
                {format(t)}
              </text>
            </g>
          ))}
          {ticks(x0, x1).map((t) => (
            <text
              key={`x${t}`}
              x={sx(t)}
              y={H - m.b + 18}
              textAnchor="middle"
              className="chart-tick"
            >
              {format(t)}
            </text>
          ))}
          <text
            x={(m.l + W - m.r) / 2}
            y={H - 4}
            textAnchor="middle"
            className="chart-axis"
          >
            {header[x]}
          </text>
          <text
            x={14}
            y={(m.t + H - m.b) / 2}
            textAnchor="middle"
            className="chart-axis"
            transform={`rotate(-90 14 ${(m.t + H - m.b) / 2})`}
          >
            {header[y]}
          </text>
          {fit && (
            <line
              x1={sx(x0)}
              x2={sx(x1)}
              y1={sy(intercept + slope * x0)}
              y2={sy(intercept + slope * x1)}
              className="chart-fit-line"
            />
          )}
          {points.map((p) => {
            const key = `row:${p.r + 1}`;
            return (
              <g
                key={p.r}
                className={`chart-point ${focus === key ? "is-focus" : ""}`}
                onMouseEnter={() => setHover(p.r)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onAnchor(key)}
              >
                <circle
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r={14}
                  className="chart-hit"
                />
                <circle cx={sx(p.x)} cy={sy(p.y)} r={focus === key ? 7 : 5} />
                <text x={sx(p.x) + 9} y={sy(p.y) - 8} className="chart-label">
                  {p.r + 1}
                </text>
              </g>
            );
          })}
        </svg>
        {hovered && (
          <p
            className="chart-tip"
            style={{
              left: `${(sx(hovered.x) / W) * 100}%`,
              top: `${(sy(hovered.y) / H) * 100}%`,
            }}
          >
            Row {hovered.r + 1}: {header[x]} {hovered.x}, {header[y]}{" "}
            {hovered.y}
          </p>
        )}
      </div>
      {fit && (
        <figcaption className="chart-caption">
          Best fit: {header[y]} = {slope.toPrecision(4)} × {header[x]}{" "}
          {intercept >= 0 ? "+" : "−"} {Math.abs(intercept).toPrecision(4)} · R²
          = {r2.toFixed(3)}
        </figcaption>
      )}
    </figure>
  );
}
