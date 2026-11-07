export type ReadingMode = "auto" | "lite" | "full";
export function readingPolicy(
  preference: string | undefined,
  saveData: string | null,
  effectiveType: string | null,
) {
  const mode: ReadingMode =
    preference === "lite" || preference === "full" ? preference : "auto";
  return {
    mode,
    lite:
      mode === "lite" ||
      (mode === "auto" &&
        (saveData?.toLowerCase() === "on" ||
          ["slow-2g", "2g", "3g"].includes(
            effectiveType?.toLowerCase() ?? "",
          ))),
  };
}
