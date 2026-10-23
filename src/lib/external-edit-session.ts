export type ExternalEditKind = "product_guide" | "integration_step";

export type ExternalEditSession = {
  kind: ExternalEditKind;
  recordId: string;
  source: "Mintlify" | "Notion";
  startedAt: number;
  workflowSnapshot: string;
  dismissed: boolean;
};

const KEY = "koinx-ext-doc-edit-v1";

export function startExternalEditSession(session: Omit<ExternalEditSession, "startedAt" | "dismissed">) {
  const payload: ExternalEditSession = { ...session, startedAt: Date.now(), dismissed: false };
  sessionStorage.setItem(KEY, JSON.stringify(payload));
}

export function readExternalEditSession(): ExternalEditSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ExternalEditSession;
  } catch {
    return null;
  }
}

export function dismissExternalEditSession() {
  const cur = readExternalEditSession();
  if (!cur) return;
  sessionStorage.setItem(KEY, JSON.stringify({ ...cur, dismissed: true }));
}

export function clearExternalEditSession() {
  sessionStorage.removeItem(KEY);
}
