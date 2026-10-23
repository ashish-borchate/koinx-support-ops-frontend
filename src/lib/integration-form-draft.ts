const KEY = "koinx-integration-new-form-v1";

export type IntegrationNewFormDraft = {
  exchangeName: string;
  integrationType: string;
  documentationSource: string;
  workingDocUrl: string;
  publishedUrl: string;
  changeReason: string;
  summaryOfChanges: string;
  frontendUpdateRequired: boolean;
};

export function saveIntegrationNewFormDraft(draft: IntegrationNewFormDraft) {
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function loadIntegrationNewFormDraft(): IntegrationNewFormDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as IntegrationNewFormDraft;
  } catch {
    return null;
  }
}

export function clearIntegrationNewFormDraft() {
  sessionStorage.removeItem(KEY);
}
