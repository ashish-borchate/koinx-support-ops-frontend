export const PG_REVIEW_SCREENSHOT_ACCEPT = "image/png,image/jpeg,image/webp";

export function pgReviewOutdatedScreenshotPath(reviewId: string, inline = true) {
  const q = inline ? "?inline=1" : "";
  return `/api/product-guides/agent-feedback/reviews/${reviewId}/outdated-screenshot${q}`;
}

export { fileToUploadPayload, formatFileSize } from "@/lib/issue-attachments";
