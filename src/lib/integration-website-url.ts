/** Public KoinX integration doc URL slug from exchange name (e.g. KuCoin → kucoin). */
export function integrationExchangeSlug(exchangeName: string) {
  return exchangeName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9-]/g, "");
}

export function defaultIntegrationWebsiteUrl(exchangeName: string) {
  const slug = integrationExchangeSlug(exchangeName);
  return slug ? `https://www.koinx.com/integration/${slug}` : "";
}

function isKoinxWebsiteHost(hostname: string) {
  const h = hostname.toLowerCase();
  return h === "koinx.com" || h === "www.koinx.com";
}

function isIntegrationPathUrl(url: string) {
  try {
    const u = new URL(url);
    return isKoinxWebsiteHost(u.hostname) && u.pathname.toLowerCase().includes("/integration/");
  } catch {
    return false;
  }
}

function isGenericGuidesHubUrl(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "") || "/";
    return isKoinxWebsiteHost(u.hostname) && (path === "/guides" || path === "/guides/");
  } catch {
    return false;
  }
}

/**
 * Customer-facing integration page on koinx.com (proposed or confirmed URL).
 * Uses a stored URL when it is a specific /integration/… page; otherwise derives from exchange name.
 * Ignores generic /guides hub URLs saved by mistake.
 *
 * UI must not treat the derived URL as published documentation until `mintlifyStatus === "Published"`.
 */
export function resolveIntegrationWebsiteUrl(exchangeName: string, storedUrl?: string) {
  const stored = (storedUrl || "").trim();
  if (stored && isIntegrationPathUrl(stored) && !isGenericGuidesHubUrl(stored)) {
    return stored;
  }
  const derived = defaultIntegrationWebsiteUrl(exchangeName);
  if (derived) return derived;
  return stored;
}
