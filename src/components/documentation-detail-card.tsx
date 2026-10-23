import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  externalLinkProps,
  mintlifyFallback,
  normalizeDocumentationSource,
  type DocumentationSource,
} from "@/lib/documentation-links";
import {
  publishedDocumentationLinkLabel,
  publishedDocumentationStatusText,
  type DocumentationPublicationPhase,
} from "@/lib/documentation-publication";
import { startExternalEditSession } from "@/lib/external-edit-session";

export type DocumentationDetailKind = "productGuides" | "integrationSteps";

type Props = {
  kind: DocumentationDetailKind;
  recordId: string;
  workflowSnapshot: string;
  source: DocumentationSource;
  workingDocUrl: string;
  /** Confirmed public documentation URL — only after publication confirmation (not generated/proposed). */
  confirmedPublishedUrl?: string;
  publicationPhase: DocumentationPublicationPhase;
  /** When true, an in-progress update exists on an already-published record. */
  pendingUpdateOnPublished?: boolean;
  showExternalEditor?: boolean;
  /** Compact label/value rows; no Open button (product guides detail). */
  layout?: "default" | "compact";
};

type EditorDocLink =
  | { kind: "working"; href: string; label: string }
  | { kind: "workspace"; href: string }
  | { kind: "unavailable" };

function resolveEditorDocLink(
  kind: DocumentationDetailKind,
  docSource: DocumentationSource,
  workingDocUrl: string,
): EditorDocLink {
  const trimmedWorking = (workingDocUrl || "").trim();
  if (trimmedWorking) {
    const label = "Open Documentation";
    return { kind: "working", href: trimmedWorking, label };
  }
  if (docSource === "Mintlify") {
    const workspace = mintlifyFallback(kind).trim();
    if (workspace) return { kind: "workspace", href: workspace };
  }
  return { kind: "unavailable" };
}

export function DocumentationDetailCard({
  kind,
  recordId,
  workflowSnapshot,
  source,
  workingDocUrl,
  confirmedPublishedUrl,
  publicationPhase,
  pendingUpdateOnPublished,
  showExternalEditor,
  layout = "default",
}: Props) {
  const docSource = normalizeDocumentationSource(source);
  const confirmedPublished = (confirmedPublishedUrl || "").trim();
  const editorLink = resolveEditorDocLink(kind, docSource, workingDocUrl);
  const showPublishedLink = publicationPhase === "published" && Boolean(confirmedPublished);
  const publishedLinkLabel = publishedDocumentationLinkLabel(publicationPhase, Boolean(pendingUpdateOnPublished));
  const publicationStatusText = publishedDocumentationStatusText(publicationPhase);

  function openHref(href: string) {
    if (!showExternalEditor) return;
    startExternalEditSession({
      kind: kind === "productGuides" ? "product_guide" : "integration_step",
      recordId,
      source: docSource,
      workflowSnapshot,
    });
    window.open(href, "_blank", "noopener,noreferrer");
  }

  const editorAccessLabel =
    editorLink.kind === "working"
      ? editorLink.label
      : editorLink.kind === "workspace"
        ? "Open Mintlify Workspace"
        : null;

  if (layout === "compact") {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Documentation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid gap-1 sm:grid-cols-[minmax(8rem,11rem)_1fr] sm:gap-x-4 sm:items-baseline">
            <span className="text-muted-foreground">Published documentation</span>
            <span className="min-w-0 text-right sm:text-left">
              {showPublishedLink ? (
                <a
                  className="break-all font-medium text-primary no-underline hover:text-primary/90"
                  {...externalLinkProps(confirmedPublished)}
                >
                  {publishedLinkLabel}
                </a>
              ) : publicationPhase === "published" ? (
                <span className="text-foreground/90">Not Recorded Yet</span>
              ) : (
                <span className="text-foreground/90">{publicationStatusText}</span>
              )}
            </span>
          </div>
          <div className="grid gap-1 sm:grid-cols-[minmax(8rem,11rem)_1fr] sm:gap-x-4 sm:items-baseline">
            <span className="text-muted-foreground">Documentation</span>
            <span className="min-w-0 text-right sm:text-left">
              {editorLink.kind === "unavailable" ? (
                <span className="text-foreground/80">Link not configured</span>
              ) : showExternalEditor ? (
                <button
                  type="button"
                  className="font-medium text-primary no-underline hover:text-primary/90"
                  onClick={() => openHref(editorLink.href)}
                >
                  {editorAccessLabel}
                </button>
              ) : (
                <a
                  className="font-medium text-primary no-underline hover:text-primary/90"
                  {...externalLinkProps(editorLink.href)}
                >
                  {editorAccessLabel}
                </a>
              )}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const defaultEditLabel =
    docSource === "Notion"
      ? "Open in Notion"
      : editorLink.kind === "workspace"
        ? "Open Mintlify Workspace"
        : editorLink.kind === "working"
          ? "Open Documentation"
          : "Open Documentation";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Documentation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          <span className="text-muted-foreground">Source · </span>
          {docSource}
        </p>
        <div>
          <p className="text-muted-foreground">Published documentation</p>
          {showPublishedLink ? (
            <a
              className="break-all font-medium text-primary underline hover:text-primary/90"
              {...externalLinkProps(confirmedPublished)}
            >
              {publishedLinkLabel}
            </a>
          ) : (
            <p className="text-foreground/90">
              {publicationPhase === "published" ? "Not Recorded Yet" : publicationStatusText}
            </p>
          )}
        </div>
        {showExternalEditor && editorLink.kind !== "unavailable" ? (
          <Button type="button" size="sm" className="mt-1" onClick={() => openHref(editorLink.href)}>
            {defaultEditLabel}
          </Button>
        ) : null}
        {showExternalEditor && editorLink.kind === "unavailable" ? (
          <p className="text-foreground/80">Documentation link not configured</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** @deprecated use DocumentationDetailCard */
export const IntegrationDocumentationSummary = DocumentationDetailCard;
