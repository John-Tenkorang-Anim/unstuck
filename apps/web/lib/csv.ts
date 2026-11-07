/** Parse simple comma-separated data with a header row. Quoted fields aren’t supported. */
export function parseCsv(csv: string) {
  const [head = "", ...rows] = csv.trim().split(/\r?\n/);
  return {
    header: head.split(",").map((cell) => cell.trim()),
    rows: rows
      .filter((row) => row.trim())
      .map((row) => row.split(",").map((cell) => cell.trim())),
  };
}
