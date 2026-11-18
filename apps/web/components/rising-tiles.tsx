/**
 * The brand story in motion, with no script at all: tiles like the logo
 * drift upward and change from clay red through harvest gold to leaf green
 * as they rise. Plain CSS, so it costs nothing to load and stops for people
 * who prefer reduced motion or light reading.
 */
const tiles = [
  { x: 8, s: 26, d: 14, delay: 0, r: -12 },
  { x: 22, s: 18, d: 11, delay: -4, r: 8 },
  { x: 34, s: 34, d: 17, delay: -9, r: -4 },
  { x: 47, s: 22, d: 12, delay: -2, r: 14 },
  { x: 58, s: 30, d: 15, delay: -11, r: -9 },
  { x: 69, s: 16, d: 10, delay: -6, r: 6 },
  { x: 80, s: 28, d: 16, delay: -13, r: -15 },
  { x: 90, s: 20, d: 13, delay: -8, r: 10 },
  { x: 15, s: 14, d: 9, delay: -7, r: 20 },
  { x: 52, s: 12, d: 8, delay: -3, r: -20 },
  { x: 74, s: 24, d: 18, delay: -15, r: 3 },
  { x: 40, s: 16, d: 12, delay: -10, r: -6 },
];

export function RisingTiles() {
  return (
    <div className="dv-hero-art" aria-hidden="true">
      {tiles.map((t, i) => (
        <i
          key={i}
          style={{
            left: `${t.x}%`,
            width: t.s,
            height: t.s,
            animationDuration: `${t.d}s`,
            animationDelay: `${t.delay}s`,
            ["--turn" as string]: `${t.r}deg`,
          }}
        />
      ))}
    </div>
  );
}
