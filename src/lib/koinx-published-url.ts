const KOINX_SITE_ORIGIN = "https://www.koinx.com";

/** Public KoinX docs URL from a stored path or full URL. */
export function toKoinxPublishedDocumentationUrl(url: string): string {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return `${KOINX_SITE_ORIGIN}${trimmed}`;
  return trimmed;
}
