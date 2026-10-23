/** Whether a public documentation URL may be shown as live published documentation in the UI. */
export type DocumentationPublicationPhase = "not_published" | "awaiting_publication" | "published";

export function integrationPublicationPhase(integration: {
  mintlifyStatus?: string;
  workflowStatus?: string;
  pendingUpdate?: { status?: string; active?: boolean } | null;
}): DocumentationPublicationPhase {
  if (integration.mintlifyStatus === "Published") return "published";
  if (
    integration.pendingUpdate?.status === "Ready to Publish" ||
    integration.workflowStatus === "Pending Mintlify"
  ) {
    return "awaiting_publication";
  }
  return "not_published";
}

export function productGuidePublicationPhase(guide: {
  status?: string;
  pendingUpdate?: { status?: string; active?: boolean } | null;
}): DocumentationPublicationPhase {
  if (guide.status === "Published") return "published";
  if (
    guide.pendingUpdate?.status === "Ready to Publish" ||
    guide.status === "Ready to Publish" ||
    guide.status === "Approved — Ready to Publish"
  ) {
    return "awaiting_publication";
  }
  return "not_published";
}

export function publishedDocumentationLinkLabel(
  phase: DocumentationPublicationPhase,
  hasPendingUpdateOnPublishedRecord: boolean,
): string {
  if (phase !== "published") return "";
  return hasPendingUpdateOnPublishedRecord
    ? "View Currently Published Documentation"
    : "View Published Documentation";
}

export function publishedDocumentationStatusText(phase: DocumentationPublicationPhase): string {
  if (phase === "published") return "";
  if (phase === "awaiting_publication") return "Awaiting Publication";
  return "Not Published";
}
