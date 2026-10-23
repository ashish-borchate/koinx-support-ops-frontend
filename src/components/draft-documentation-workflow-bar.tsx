import { Button } from "@/components/ui/button";
import { openDocumentationExternally } from "@/lib/open-documentation";
import type { DocumentationSource } from "@/lib/documentation-links";
import type { DocumentationDetailKind } from "@/components/documentation-detail-card";
import { toast } from "sonner";

type Props = {
  kind: DocumentationDetailKind;
  source: DocumentationSource;
  workingDocUrl: string;
  confirmMintlifyUpdates?: boolean;
  returnDocumentationToDraft?: boolean;
  confirmPending?: boolean;
  onEditDetails: () => void;
  onMarkMintlifyComplete: () => void;
  onReturnToDraft: () => void;
  className?: string;
};

export function DraftDocumentationWorkflowBar({
  kind,
  source,
  workingDocUrl,
  confirmMintlifyUpdates,
  returnDocumentationToDraft,
  confirmPending,
  onEditDetails,
  onMarkMintlifyComplete,
  onReturnToDraft,
  className,
}: Props) {
  if (!confirmMintlifyUpdates && !returnDocumentationToDraft) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      {confirmMintlifyUpdates ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const ok = openDocumentationExternally(kind, source, workingDocUrl);
              if (!ok) toast.error("Documentation link is not configured.");
            }}
          >
            Open Mintlify
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onEditDetails}>
            Edit Details
          </Button>
          <Button type="button" size="sm" disabled={confirmPending} onClick={onMarkMintlifyComplete}>
            Mark Mintlify Updates Complete
          </Button>
        </>
      ) : null}
      {returnDocumentationToDraft ? (
        <Button type="button" size="sm" variant="outline" onClick={onReturnToDraft}>
          Return to Draft
        </Button>
      ) : null}
    </div>
  );
}
