import type { PlaybookRoleKey } from "./roles";
import { PLAYBOOK_ROLE_KEYS, isPlaybookRoleKey } from "./roles";

const PREVIEW_STORAGE_KEY = "koinx-handbook-preview-role";

/** Roles whose playbook content a viewer may read (handbook visibility, not app permissions). */
export function playbookRolesForViewer(viewerRole: PlaybookRoleKey): PlaybookRoleKey[] {
  if (viewerRole === "supervisor" || viewerRole === "admin") return [...PLAYBOOK_ROLE_KEYS];
  return [viewerRole];
}

export function canViewPlaybookRole(viewerRole: PlaybookRoleKey, targetRole: PlaybookRoleKey): boolean {
  return playbookRolesForViewer(viewerRole).includes(targetRole);
}

export function canPreviewOtherRoles(viewerRole: PlaybookRoleKey): boolean {
  return viewerRole === "supervisor" || viewerRole === "admin";
}

export function readHandbookPreviewRole(): PlaybookRoleKey | null {
  try {
    const raw = localStorage.getItem(PREVIEW_STORAGE_KEY);
    if (!raw) return null;
    return isPlaybookRoleKey(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeHandbookPreviewRole(role: PlaybookRoleKey | null) {
  try {
    if (!role) localStorage.removeItem(PREVIEW_STORAGE_KEY);
    else localStorage.setItem(PREVIEW_STORAGE_KEY, role);
  } catch {
    /* ignore */
  }
}

/**
 * Effective role for handbook filtering: preview role when allowed, else viewer role.
 */
export function handbookAudienceRole(
  viewerRole: PlaybookRoleKey | null,
  previewRole: PlaybookRoleKey | null,
): PlaybookRoleKey | null {
  if (!viewerRole) return null;
  if (previewRole && canPreviewOtherRoles(viewerRole) && isPlaybookRoleKey(previewRole)) {
    return previewRole;
  }
  return viewerRole;
}

export function workflowVisibleToRole(
  workflowRoles: PlaybookRoleKey[] | "all",
  audienceRole: PlaybookRoleKey | null,
): boolean {
  if (!audienceRole) return false;
  if (workflowRoles === "all") return true;
  return workflowRoles.includes(audienceRole);
}
