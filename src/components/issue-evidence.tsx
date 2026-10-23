import { useEffect, useRef, useState } from "react";
import { FileIcon, ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { download, getToken, getViewAs } from "@/lib/api";
import {
  attachmentDownloadPath,
  deleteIssueAttachment,
  formatFileSize,
  ISSUE_EVIDENCE_ACCEPT,
  ISSUE_EVIDENCE_MAX_PER_ISSUE,
  uploadIssueAttachments,
  type IssueAttachmentMeta,
} from "@/lib/issue-attachments";
import { cn } from "@/lib/utils";

export type PendingEvidenceFile = {
  key: string;
  file: File;
  previewUrl?: string;
};

function apiUrl(path: string) {
  const base = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  return `${base}${path}`;
}

async function fetchBlobUrl(path: string) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const viewAs = getViewAs();
  if (viewAs) headers.set("X-View-As", viewAs);
  const response = await fetch(apiUrl(path), { headers });
  if (!response.ok) throw new Error("Could not load file");
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export function IssueEvidencePicker({
  files,
  onChange,
  maxFiles = ISSUE_EVIDENCE_MAX_PER_ISSUE,
  disabled,
  className,
  showHelper = true,
}: {
  files: PendingEvidenceFile[];
  onChange: (files: PendingEvidenceFile[]) => void;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
  /** When false, parent supplies label/helper copy above the drop zone. */
  showHelper?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(list: FileList | File[]) {
    const next = [...files];
    for (const file of Array.from(list)) {
      if (next.length >= maxFiles) break;
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (next.some((f) => f.key === key)) continue;
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      next.push({ key, file, previewUrl });
    }
    onChange(next);
  }

  useEffect(() => {
    return () => {
      for (const f of files) {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      }
    };
  }, [files]);

  return (
    <div className={cn("space-y-2", className)}>
      {showHelper ? (
        <p className="text-xs text-muted-foreground">Add screenshots or files that help explain the issue.</p>
      ) : null}
      <div
        className={cn(
          "rounded-lg border border-dashed border-border/80 bg-muted/15 px-3 py-4 text-center transition-colors",
          dragOver && "border-primary/50 bg-primary/5",
          disabled && "opacity-60",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ISSUE_EVIDENCE_ACCEPT}
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="secondary" size="sm" disabled={disabled || files.length >= maxFiles} onClick={() => inputRef.current?.click()}>
          Browse files
        </Button>
        <p className="mt-1 text-[11px] text-muted-foreground">PNG, JPEG, WEBP, PDF, CSV, Excel · up to {maxFiles} files</p>
      </div>
      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {files.map((item) => (
            <li key={item.key} className="relative flex max-w-[9rem] flex-col gap-1 rounded-md border border-border/60 bg-card p-1.5 text-xs">
              {item.previewUrl ? (
                <img src={item.previewUrl} alt="" className="h-14 w-full rounded object-cover" />
              ) : (
                <div className="flex h-14 items-center justify-center rounded bg-muted/40 text-muted-foreground">
                  <FileIcon className="size-5" />
                </div>
              )}
              <span className="truncate font-medium" title={item.file.name}>{item.file.name}</span>
              <span className="text-[10px] text-muted-foreground">{formatFileSize(item.file.size)}</span>
              {!disabled ? (
                <button
                  type="button"
                  className="absolute -right-1 -top-1 rounded-full border border-border bg-background p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="Remove file"
                  onClick={() => {
                    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
                    onChange(files.filter((f) => f.key !== item.key));
                  }}
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AttachmentChip({
  issueId,
  item,
  canDelete,
  onDeleted,
}: {
  issueId: string;
  item: IssueAttachmentMeta;
  canDelete?: boolean;
  onDeleted?: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (item.previewKind !== "image") return;
    let url: string | null = null;
    void fetchBlobUrl(attachmentDownloadPath(issueId, item.id, true))
      .then((u) => {
        url = u;
        setThumbUrl(u);
      })
      .catch(() => undefined);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [issueId, item.id, item.previewKind]);

  useEffect(() => {
    if (!previewOpen || item.previewKind !== "image") return;
    return () => {
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    };
  }, [previewOpen, item.previewKind, thumbUrl]);

  const label = item.originalName;

  return (
    <>
      <div className="flex max-w-[8.5rem] flex-col gap-1 rounded-md border border-border/60 bg-muted/10 p-1.5 text-xs">
        <button
          type="button"
          className="block w-full text-left"
          onClick={() => {
            if (item.previewKind === "image") setPreviewOpen(true);
            else void download(attachmentDownloadPath(issueId, item.id), item.originalName);
          }}
        >
          {item.previewKind === "image" && thumbUrl ? (
            <img src={thumbUrl} alt="" className="mb-1 h-12 w-full rounded object-cover" />
          ) : (
            <div className="mb-1 flex h-12 items-center justify-center rounded bg-muted/30 text-muted-foreground">
              {item.previewKind === "pdf" ? <FileIcon className="size-4" /> : <ImageIcon className="size-4" />}
            </div>
          )}
          <span className="block truncate font-medium" title={label}>{label}</span>
          <span className="text-[10px] text-muted-foreground">{formatFileSize(item.size)}</span>
        </button>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 flex-1 px-1 text-[10px]"
            onClick={() => void download(attachmentDownloadPath(issueId, item.id), item.originalName)}
          >
            Open
          </Button>
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1 text-[10px] text-destructive"
              onClick={() => onDeleted?.()}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      {item.previewKind === "image" && thumbUrl ? (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="truncate text-sm">{label}</DialogTitle>
            </DialogHeader>
            <img src={thumbUrl} alt={label} className="max-h-[70vh] w-full object-contain" />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

export function IssueEvidenceGallery({
  issueId,
  attachments,
  canUpload,
  canDelete,
  onChange,
  compact,
}: {
  issueId: string;
  attachments: IssueAttachmentMeta[];
  canUpload?: boolean;
  canDelete?: (item: IssueAttachmentMeta) => boolean;
  onChange?: () => void;
  compact?: boolean;
}) {
  const [pending, setPending] = useState<PendingEvidenceFile[]>([]);
  const [uploading, setUploading] = useState(false);

  if (!compact && attachments.length === 0 && !canUpload) return null;

  async function commitUpload() {
    if (!pending.length) return;
    setUploading(true);
    try {
      await uploadIssueAttachments(issueId, pending.map((p) => p.file));
      setPending([]);
      onChange?.();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {!compact ? <h3 className="text-sm font-semibold text-foreground">Evidence / Attachments</h3> : null}
      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {attachments.map((item) => (
            <AttachmentChip
              key={item.id}
              issueId={issueId}
              item={item}
              canDelete={canDelete?.(item)}
              onDeleted={async () => {
                await deleteIssueAttachment(issueId, item.id);
                onChange?.();
              }}
            />
          ))}
        </div>
      ) : compact ? null : (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      )}
      {canUpload ? (
        <div className="space-y-2 border-t border-border/40 pt-3">
          <IssueEvidencePicker files={pending} onChange={setPending} maxFiles={ISSUE_EVIDENCE_MAX_PER_ISSUE - attachments.length} />
          {pending.length > 0 ? (
            <Button type="button" size="sm" disabled={uploading} onClick={() => void commitUpload()}>
              {uploading ? "Uploading…" : `Upload ${pending.length} file${pending.length > 1 ? "s" : ""}`}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
