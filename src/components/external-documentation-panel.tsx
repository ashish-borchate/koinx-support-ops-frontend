import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GuideUpdateReasonFields } from "@/components/guide-update-reason-fields";
import { IntegrationUpdateReasonFields } from "@/components/integration-update-reason-fields";
import { formatGuideUpdateReasonDisplay } from "@/lib/guide-update-reason";
import { formatIntegrationUpdateReasonDisplay } from "@/lib/integration-update-reason";
import {
  externalLinkProps,
  normalizeDocumentationSource,
  resolveWorkingUrl,
  workingUrlMismatchWarning,
  type DocumentationSource,
} from "@/lib/documentation-links";
import { startExternalEditSession } from "@/lib/external-edit-session";

export type ExternalDocFields = {
  documentationSource: DocumentationSource;
  workingDocUrl: string;
  publishedUrl: string;
  summaryOfChanges: string;
  updateReason: string;
};

type Props = {
  kind: "productGuides" | "integrationSteps";
  recordId?: string;
  workflowSnapshot?: string;
  readOnly?: boolean;
  values: ExternalDocFields;
  onChange?: (patch: Partial<ExternalDocFields>) => void;
  showUpdateReason?: boolean;
  updateReasonMode?: "hidden" | "textarea" | "dropdown" | "integration-dropdown";
  updateReasonRequired?: boolean;
  showSummary?: boolean;
  summaryLabel?: string;
  showPublishedUrlField?: boolean;
  showWorkingUrlField?: boolean;
  showPublishedViewButton?: boolean;
  onBeforeExternalEdit?: () => void;
  /** Resolved public site URL for read-only “View on Website” (e.g. integration slug). */
  publishedWebsiteHref?: string;
};

export function ExternalDocumentationPanel({
  kind,
  recordId,
  workflowSnapshot = "",
  readOnly,
  values,
  onChange,
  showUpdateReason,
  updateReasonMode = "textarea",
  updateReasonRequired,
  showSummary = true,
  summaryLabel = "Summary of changes",
  showPublishedUrlField = true,
  showWorkingUrlField = true,
  showPublishedViewButton: _showPublishedViewButton = true,
  onBeforeExternalEdit,
  publishedWebsiteHref,
}: Props) {
  const source = normalizeDocumentationSource(values.documentationSource);
  const workingHref = resolveWorkingUrl(values.workingDocUrl, kind, source);
  const hasDedicatedWorkingUrl = Boolean((values.workingDocUrl || "").trim());
  const editLabel =
    source === "Notion"
      ? "Open in Notion"
      : hasDedicatedWorkingUrl
        ? "Edit in Mintlify"
        : "Open Mintlify";
  const urlMismatch = workingUrlMismatchWarning(values.workingDocUrl, source);

  function trackEditOpen(href: string) {
    if (!href) return;
    if (!recordId || readOnly) return;
    onBeforeExternalEdit?.();
    startExternalEditSession({
      kind: kind === "productGuides" ? "product_guide" : "integration_step",
      recordId,
      source,
      workflowSnapshot,
    });
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Documentation</h3>
        <p className="text-sm text-muted-foreground">
          Author content in Mintlify or Notion. This hub tracks links, verification, and publication only.
        </p>
      </div>

      {readOnly ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Source</dt><dd>{source}</dd></div>
          {showUpdateReason && values.updateReason ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Reason for update</dt>
              <dd>
                {kind === "integrationSteps"
                  ? formatIntegrationUpdateReasonDisplay(values.updateReason)
                  : formatGuideUpdateReasonDisplay(values.updateReason)}
              </dd>
            </div>
          ) : null}
          {publishedWebsiteHref || values.publishedUrl ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Published website</dt>
              <dd>
                <a
                  className="break-all font-medium text-primary underline hover:text-primary/90"
                  {...externalLinkProps(publishedWebsiteHref || values.publishedUrl)}
                >
                  {publishedWebsiteHref || values.publishedUrl}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Documentation source</Label>
              <Select
                value={source}
                onValueChange={(v) => onChange?.({ documentationSource: normalizeDocumentationSource(v) })}
              >
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mintlify">Mintlify</SelectItem>
                  <SelectItem value="Notion">Notion</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {showWorkingUrlField ? (
            <div className="space-y-2">
              <Label>Working / draft URL</Label>
              <Input
                placeholder={source === "Notion" ? "https://www.notion.so/…" : "https://app.mintlify.com/…"}
                value={values.workingDocUrl}
                onChange={(e) => onChange?.({ workingDocUrl: e.target.value })}
              />
              {urlMismatch ? <p className="text-xs text-amber-800 dark:text-amber-200">{urlMismatch}</p> : null}
              {source === "Mintlify" ? (
                <p className="text-xs text-muted-foreground">
                  Leave blank to use the configured Mintlify workspace fallback when opening the editor.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Enter the Notion page you edit. A Mintlify fallback is not used for Notion.</p>
              )}
            </div>
          ) : null}
          {showPublishedUrlField ? (
            <div className="space-y-2">
              <Label>Published website URL</Label>
              <Input
                placeholder="https://www.koinx.com/integration/…"
                value={values.publishedUrl}
                onChange={(e) => onChange?.({ publishedUrl: e.target.value })}
              />
            </div>
          ) : null}
          {showSummary ? (
            <div className="space-y-2">
              <Label>{summaryLabel}</Label>
              <Textarea value={values.summaryOfChanges} onChange={(e) => onChange?.({ summaryOfChanges: e.target.value })} />
            </div>
          ) : null}
          {showUpdateReason && updateReasonMode === "dropdown" ? (
            <GuideUpdateReasonFields
              value={values.updateReason}
              onChange={(stored) => onChange?.({ updateReason: stored })}
              required={updateReasonRequired}
            />
          ) : null}
          {showUpdateReason && updateReasonMode === "integration-dropdown" ? (
            <IntegrationUpdateReasonFields
              value={values.updateReason}
              onChange={(stored) => onChange?.({ updateReason: stored })}
              required={updateReasonRequired}
            />
          ) : null}
          {showUpdateReason && updateReasonMode === "textarea" ? (
            <div className="space-y-2">
              <Label>Reason for update</Label>
              <Textarea value={values.updateReason} onChange={(e) => onChange?.({ updateReason: e.target.value })} />
            </div>
          ) : null}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {!readOnly && showWorkingUrlField ? (
          <Button
            type="button"
            variant="default"
            disabled={source === "Notion" && !workingHref}
            onClick={() => trackEditOpen(workingHref)}
          >
            {editLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
