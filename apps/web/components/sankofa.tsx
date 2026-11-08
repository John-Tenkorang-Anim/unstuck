/**
 * Sankofa, in its heart form: an Akan Adinkra symbol from Ghana meaning "go
 * back and get it". Its proverb, "Se wo were fi na wosankofa a yenkyi", says it
 * is not wrong to go back for what you forgot. Learning from what failed.
 */
export function Sankofa({
  size = 64,
  title,
}: {
  size?: number;
  title?: string;
}) {
  return (
    <svg
      className="sankofa"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={7}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {/* The two sides of the heart, each curling back into a spiral. */}
      <path d="M60 104 C34 84 14 64 15 42 C16 22 36 12 50 22 C60 30 56 45 45 45 C37 45 35 35 43 32" />
      <path d="M60 104 C86 84 106 64 105 42 C104 22 84 12 70 22 C60 30 64 45 75 45 C83 45 85 35 77 32" />
      {/* The small spirals either side of the point. */}
      <path d="M51 97 C42 94 37 103 43 109 C48 113 54 108 50 104" />
      <path d="M69 97 C78 94 83 103 77 109 C72 113 66 108 70 104" />
    </svg>
  );
}
