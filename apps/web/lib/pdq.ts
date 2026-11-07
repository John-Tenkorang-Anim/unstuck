/**
 * PDQ perceptual hashing (Meta, BSD licence), the format industry hash-sharing
 * programmes distribute. Follows the published algorithm: luminance, two
 * passes of Jarosz box filters, decimation to 64×64, a 16×16 DCT, and one bit
 * per coefficient above the median. Visually similar images give hashes a
 * small Hamming distance apart; 31 or less is the usual match threshold.
 * Checked bit-for-bit against the reference `pdqhash` package on the sample
 * photos: the 64-character hex matches the reference read most-significant
 * bit first.
 */
const N = 64;
const dct = (() => {
  const scale = Math.sqrt(2 / N);
  return Array.from({ length: 16 }, (_, i) =>
    Float64Array.from(
      { length: N },
      (_, j) => scale * Math.cos((Math.PI / 2 / N) * (i + 1) * (2 * j + 1)),
    ),
  );
})();

function box1d(
  input: Float64Array,
  output: Float64Array,
  offset: number,
  length: number,
  stride: number,
  window: number,
) {
  const half = Math.floor((window + 2) / 2);
  const phase1 = half - 1;
  const phase2 = window - half + 1;
  const phase3 = length - window;
  const phase4 = half - 1;
  let li = offset,
    ri = offset,
    oi = offset,
    sum = 0,
    size = 0;
  for (let i = 0; i < phase1; i++) {
    sum += input[ri];
    size++;
    ri += stride;
  }
  for (let i = 0; i < phase2; i++) {
    sum += input[ri];
    size++;
    output[oi] = sum / size;
    ri += stride;
    oi += stride;
  }
  for (let i = 0; i < phase3; i++) {
    sum += input[ri] - input[li];
    output[oi] = sum / size;
    li += stride;
    ri += stride;
    oi += stride;
  }
  for (let i = 0; i < phase4; i++) {
    sum -= input[li];
    size--;
    output[oi] = sum / size;
    li += stride;
    oi += stride;
  }
}
const windowFor = (dimension: number) =>
  Math.floor((dimension + 2 * N - 1) / (2 * N));

/** Hash a luminance image (row-major, values 0–255). */
export function pdqFromLuma(luma: Float64Array, rows: number, cols: number) {
  const a = luma,
    b = new Float64Array(rows * cols);
  const alongRows = windowFor(cols),
    alongCols = windowFor(rows);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < rows; i++) box1d(a, b, i * cols, cols, 1, alongRows);
    for (let j = 0; j < cols; j++) box1d(b, a, j, rows, cols, alongCols);
  }
  const small = new Float64Array(N * N);
  for (let i = 0; i < N; i++) {
    const ii = Math.floor(((i + 0.5) * rows) / N);
    for (let j = 0; j < N; j++)
      small[i * N + j] = a[ii * cols + Math.floor(((j + 0.5) * cols) / N)];
  }
  let gradient = 0;
  for (let i = 0; i < N - 1; i++)
    for (let j = 0; j < N; j++)
      gradient += Math.trunc(
        Math.abs(((small[i * N + j] - small[(i + 1) * N + j]) * 100) / 255),
      );
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N - 1; j++)
      gradient += Math.trunc(
        Math.abs(((small[i * N + j] - small[i * N + j + 1]) * 100) / 255),
      );
  const quality = Math.min(100, Math.trunc(gradient / 90));
  const t = Array.from({ length: 16 }, (_, i) => {
    const row = new Float64Array(N);
    for (let j = 0; j < N; j++) {
      let s = 0;
      for (let k = 0; k < N; k++) s += dct[i][k] * small[k * N + j];
      row[j] = s;
    }
    return row;
  });
  const coefficients = new Float64Array(256);
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 16; j++) {
      let s = 0;
      for (let k = 0; k < N; k++) s += t[i][k] * dct[j][k];
      coefficients[i * 16 + j] = s;
    }
  const sorted = [...coefficients].sort((x, y) => x - y);
  const median = sorted[127];
  const words = new Uint16Array(16);
  coefficients.forEach((value, k) => {
    if (value > median) words[k >> 4] |= 1 << (k & 15);
  });
  return {
    hex: [...words]
      .reverse()
      .map((w) => w.toString(16).padStart(4, "0"))
      .join(""),
    quality,
  };
}
/** Hash RGB pixels (3 bytes per pixel, row-major). */
export function pdqFromRgb(rgb: Uint8Array, rows: number, cols: number) {
  const luma = new Float64Array(rows * cols);
  for (let p = 0, q = 0; p < luma.length; p++, q += 3)
    luma[p] = 0.299 * rgb[q] + 0.587 * rgb[q + 1] + 0.114 * rgb[q + 2];
  return pdqFromLuma(luma, rows, cols);
}
export function hamming(a: string, b: string) {
  let distance = 0;
  for (let i = 0; i < 64; i += 8) {
    let x = parseInt(a.slice(i, i + 8), 16) ^ parseInt(b.slice(i, i + 8), 16);
    while (x) {
      distance += x & 1;
      x >>>= 1;
    }
  }
  return distance;
}
