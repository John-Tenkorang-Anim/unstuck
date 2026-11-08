/** Keep sign-in return paths inside Unstuck, including their current tab/context. */
export function safeReturnTo(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') ||
    /^\/(?:\/|%2f|%5c)/i.test(value) || /[\\\u0000-\u001f\u007f]/.test(value)) return undefined;
  try { return new URL(value, 'https://unstuck.invalid').origin === 'https://unstuck.invalid' ? value : undefined; }
  catch { return undefined; }
}
export function signInHref() {
  const next = typeof location === 'undefined' ? '/discover' : `${location.pathname}${location.search}${location.hash}`;
  return `/account?next=${encodeURIComponent(next)}`;
}
