import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type MentionScope = "coaching" | "reported_issue" | "product_guide" | "integration_step";

export function mentionablesUrl(scope: MentionScope, recordId: string, query = "") {
  const params = new URLSearchParams({ scope, recordId });
  if (query) params.set("q", query);
  return `/api/hub-mentions/mentionables?${params.toString()}`;
}

/** Marks all mentions for this user on the record read (HubNotificationDismiss). Opening a Reported Issue clears every mention on that issue. */
export async function markMentionsRead(
  scope: MentionScope,
  recordId: string,
  options?: { queryClient?: QueryClient; dashboardUserId?: string },
) {
  await api("/api/hub-mentions/mark-read", {
    method: "POST",
    body: JSON.stringify({ scope, recordId }),
  });
  if (options?.queryClient) {
    void options.queryClient.invalidateQueries({ queryKey: ["dashboard", options.dashboardUserId] });
    void options.queryClient.invalidateQueries({ queryKey: ["hub-notifications"] });
  }
}
