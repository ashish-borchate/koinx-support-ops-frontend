import { api } from "@/lib/api";

export type IssueAttachmentMeta = {
  id: string;
  originalName: string;
  contentType: string;
  size: number;
  uploadedById: string;
  uploadedByName?: string;
  createdAt: string;
  commentId: string | null;
  previewKind: "image" | "pdf" | "csv" | "spreadsheet" | "file";
};

export const ISSUE_EVIDENCE_ACCEPT =
  "image/png,image/jpeg,image/webp,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const ISSUE_EVIDENCE_MAX_PER_ISSUE = 10;

export async function fileToUploadPayload(file: File) {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
  return { originalName: file.name, contentType: file.type || "application/octet-stream", data };
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function attachmentDownloadPath(issueId: string, attachmentId: string, inline = false) {
  const q = inline ? "?inline=1" : "";
  return `/api/reported-issues/${issueId}/attachments/${attachmentId}/download${q}`;
}

export async function uploadIssueAttachment(issueId: string, file: File) {
  const payload = await fileToUploadPayload(file);
  return api<{ attachment: IssueAttachmentMeta }>(`/api/reported-issues/${issueId}/attachments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadIssueAttachments(issueId: string, files: File[]) {
  for (const file of files) {
    await uploadIssueAttachment(issueId, file);
  }
}

export async function deleteIssueAttachment(issueId: string, attachmentId: string) {
  await api(`/api/reported-issues/${issueId}/attachments/${attachmentId}`, { method: "DELETE" });
}
