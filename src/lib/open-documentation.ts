import {
  mintlifyFallback,
  normalizeDocumentationSource,
  type DocumentationSource,
} from "@/lib/documentation-links";
import type { DocumentationDetailKind } from "@/components/documentation-detail-card";

export function resolveDocumentationEditorHref(
  kind: DocumentationDetailKind,
  source: DocumentationSource,
  workingDocUrl: string,
): string | null {
  const trimmedWorking = (workingDocUrl || "").trim();
  if (trimmedWorking) return trimmedWorking;
  const docSource = normalizeDocumentationSource(source);
  if (docSource === "Mintlify") {
    const workspace = mintlifyFallback(kind).trim();
    if (workspace) return workspace;
  }
  return null;
}

/** Opens Mintlify/Notion workspace or working doc in a new tab without starting an edit session or API activity. */
export function openDocumentationExternally(
  kind: DocumentationDetailKind,
  source: DocumentationSource,
  workingDocUrl: string,
) {
  const href = resolveDocumentationEditorHref(kind, source, workingDocUrl);
  if (!href) return false;
  window.open(href, "_blank", "noopener,noreferrer");
  return true;
}
