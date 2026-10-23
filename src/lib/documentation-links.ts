export type DocumentationSource = "Mintlify" | "Notion";

const DEFAULT_PG =
  "https://app.mintlify.com/koinx-e9affad9/koinx-e9affad9/~/7a086ed0-2ec0-4e83-b1d2-f8757cbff368";
const DEFAULT_IS =
  "https://app.mintlify.com/koinx-e9affad9/koinx-e9affad9/~/62111361-3e48-4da7-9aea-01a9625ec8f9";

export function normalizeDocumentationSource(value: string | undefined): DocumentationSource {
  return value === "Notion" ? "Notion" : "Mintlify";
}

export function mintlifyFallback(kind: "productGuides" | "integrationSteps") {
  if (kind === "productGuides") {
    return (import.meta.env.VITE_MINTLIFY_FALLBACK_PRODUCT_GUIDES as string) || DEFAULT_PG;
  }
  return (import.meta.env.VITE_MINTLIFY_FALLBACK_INTEGRATION_STEPS as string) || DEFAULT_IS;
}

export function resolveWorkingUrl(
  workingUrl: string | undefined,
  kind: "productGuides" | "integrationSteps",
  source: DocumentationSource = "Mintlify",
) {
  const trimmed = (workingUrl || "").trim();
  if (trimmed) return trimmed;
  if (source === "Notion") return "";
  return mintlifyFallback(kind);
}

export function looksLikeMintlifyWorkingUrl(url: string) {
  const u = url.trim().toLowerCase();
  return u.includes("mintlify.com") || u.includes("mintlify.dev");
}

export function looksLikeNotionWorkingUrl(url: string) {
  const u = url.trim().toLowerCase();
  return u.includes("notion.so") || u.includes("notion.site");
}

export function workingUrlMismatchWarning(workingUrl: string, source: DocumentationSource): string | null {
  const trimmed = (workingUrl || "").trim();
  if (!trimmed) return null;
  if (source === "Notion" && looksLikeMintlifyWorkingUrl(trimmed)) {
    return "This URL looks like Mintlify. Enter a Notion page URL or switch the documentation source to Mintlify.";
  }
  if (source === "Mintlify" && looksLikeNotionWorkingUrl(trimmed)) {
    return "This URL looks like Notion. Enter a Mintlify URL or switch the documentation source to Notion.";
  }
  return null;
}

export function externalLinkProps(href: string) {
  return { href, target: "_blank" as const, rel: "noopener noreferrer" };
}
