import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth";
import { allHandbookWorkflows, myWorkflowsForRole } from "@/handbook/lib/role-workflows";
import { canPreviewOtherRoles, handbookAudienceRole, readHandbookPreviewRole, writeHandbookPreviewRole } from "@/handbook/lib/visibility";
import { isPlaybookRoleKey, type PlaybookRoleKey } from "@/handbook/lib/roles";

function subscribePreview(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("handbook-preview-change", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("handbook-preview-change", cb);
  };
}

function getPreviewSnapshot() {
  return readHandbookPreviewRole();
}

export function useHandbookAudience() {
  const { effective } = useAuth();
  const viewerRole = isPlaybookRoleKey(effective?.roleKey ?? "") ? (effective!.roleKey as PlaybookRoleKey) : null;
  const previewRole = useSyncExternalStore(subscribePreview, getPreviewSnapshot, () => null);

  const audienceRole = useMemo(
    () => handbookAudienceRole(viewerRole, previewRole),
    [viewerRole, previewRole],
  );

  const setPreviewRole = useCallback(
    (role: PlaybookRoleKey | null) => {
      if (!viewerRole || !canPreviewOtherRoles(viewerRole)) return;
      writeHandbookPreviewRole(role);
      window.dispatchEvent(new Event("handbook-preview-change"));
    },
    [viewerRole],
  );

  const allWorkflows = useMemo(() => allHandbookWorkflows(), []);

  const myWorkflows = useMemo(() => myWorkflowsForRole(audienceRole), [audienceRole]);

  /** @deprecated Prefer `myWorkflows` — kept for gradual migration */
  const visibleWorkflows = myWorkflows;

  const priorityWorkflowSlugs = useMemo(
    () => myWorkflows.filter((w) => w.priority <= 8).map((w) => w.slug),
    [myWorkflows],
  );

  return {
    viewerRole,
    audienceRole,
    previewRole,
    canPreview: viewerRole ? canPreviewOtherRoles(viewerRole) : false,
    setPreviewRole,
    allWorkflows,
    myWorkflows,
    visibleWorkflows,
    priorityWorkflowSlugs,
  };
}
