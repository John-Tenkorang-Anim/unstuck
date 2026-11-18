/** Initials on a tile, for organisations without a logo. */
export function OrgMark({
  name,
  size = "s",
}: {
  name: string;
  size?: "s" | "l";
}) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span className="org-mark" data-size={size} aria-hidden="true">
      {initials}
    </span>
  );
}
