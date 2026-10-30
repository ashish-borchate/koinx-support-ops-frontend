import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  KpiFreshdeskImportPreviewTable,
  type ImportPreviewRow,
} from "@/components/kpi-freshdesk-import-preview-table";
import { api } from "@/lib/api";

type HubAgent = { id: string; name: string };

type ImportSummary = {
  id: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  originalFilename: string;
  previewToken: string;
  contentHash: string;
  reportGeneratedAt: string;
  reportingFilter: string;
  periodCompleteAtGeneration: boolean;
  selectedAgentNormalizedNames?: string[];
};

type ParseResponse = {
  import: ImportSummary;
  preview: {
    period: Record<string, unknown>;
    warnings: string[];
    rows: ImportPreviewRow[];
    selectedAgentNormalizedNames: string[];
    excludedAgentNormalizedNames: string[];
    blockingIssues: string[];
    canApply: boolean;
  };
  duplicate?: boolean;
  exactDuplicate?: boolean;
  previousAppliedImport?: ImportSummary | null;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function KpiFreshdeskImportDialog({
  open,
  onOpenChange,
  agents,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: HubAgent[];
}) {
  const client = useQueryClient();
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [mappingDraft, setMappingDraft] = useState<Record<string, string>>({});
  const [selectionDraft, setSelectionDraft] = useState<Set<string>>(new Set());
  const [confirmReplace, setConfirmReplace] = useState(false);

  function syncPreviewState(data: ParseResponse) {
    const initial: Record<string, string> = {};
    for (const row of data.preview.rows) {
      if (row.match.agentId) initial[row.normalizedName] = row.match.agentId;
    }
    setMappingDraft(initial);
    const selected = data.preview.selectedAgentNormalizedNames?.length
      ? data.preview.selectedAgentNormalizedNames
      : data.preview.rows.filter((r) => r.selectedForImport).map((r) => r.normalizedName);
    setSelectionDraft(new Set(selected));
  }

  const historyQuery = useQuery({
    queryKey: ["kpi-imports"],
    queryFn: () => api<{ imports: ImportSummary[] }>("/api/kpi/import"),
    enabled: open,
  });

  const parseMutation = useMutation({
    mutationFn: async (file: File) => {
      const data = await fileToBase64(file);
      return api<ParseResponse>("/api/kpi/import/parse", {
        method: "POST",
        body: JSON.stringify({ originalName: file.name, data }),
      });
    },
    onSuccess: (data) => {
      setParseResult(data);
      setStep("preview");
      setConfirmReplace(false);
      syncPreviewState(data);
      if (data.exactDuplicate) toast.message("This exact PDF was already uploaded.");
      else toast.success("PDF parsed — review before applying.");
    },
    onError: (e) => toast.error(e.message),
  });

  const mappingsPayload = () => ({
    agentMappings: mappingDraft,
    selectedAgentNormalizedNames: [...selectionDraft].sort(),
  });

  const mappingsMutation = useMutation({
    mutationFn: () => {
      if (!parseResult) throw new Error("No import");
      return api<{ import: ImportSummary; preview: ParseResponse["preview"] }>(
        `/api/kpi/import/${parseResult.import.id}/mappings`,
        {
          method: "POST",
          body: JSON.stringify(mappingsPayload()),
        },
      );
    },
    onSuccess: (data) => {
      setParseResult((prev) => (prev ? { ...prev, import: data.import, preview: data.preview } : prev));
      const initial: Record<string, string> = {};
      for (const row of data.preview.rows) {
        if (row.match.agentId) initial[row.normalizedName] = row.match.agentId;
      }
      setMappingDraft((prev) => ({ ...initial, ...prev }));
      setSelectionDraft(new Set(data.preview.selectedAgentNormalizedNames ?? []));
      toast.success("Agent mappings saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!parseResult) throw new Error("No import");
      const mappingResult = await api<{ import: ImportSummary; preview: ParseResponse["preview"] }>(
        `/api/kpi/import/${parseResult.import.id}/mappings`,
        {
          method: "POST",
          body: JSON.stringify(mappingsPayload()),
        },
      );
      setParseResult((prev) => (prev ? { ...prev, import: mappingResult.import, preview: mappingResult.preview } : prev));
      return api<{
        success?: boolean;
        partial?: boolean;
        failed?: boolean;
        failures?: unknown[];
      }>(`/api/kpi/import/${parseResult.import.id}/apply`, {
        method: "POST",
        body: JSON.stringify({
          previewToken: mappingResult.import.previewToken,
          confirmReplace,
        }),
      });
    },
    onSuccess: (data: { success?: boolean; partial?: boolean; failed?: boolean; failures?: unknown[] }) => {
      if (data.failed) {
        toast.error("Freshdesk import failed — no agents were updated. Retry from import history.");
      } else if (data.partial) {
        toast.warning("Freshdesk import partially applied — retry to finish remaining agents.");
      } else {
        toast.success("Freshdesk import applied");
      }
      void client.invalidateQueries({ queryKey: ["kpi"] });
      void client.invalidateQueries({ queryKey: ["kpi-imports"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      if (!data.partial && !data.failed) {
        onOpenChange(false);
        setParseResult(null);
        setStep("upload");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const preview = parseResult?.preview;
  const needsReplaceConfirm = Boolean(parseResult?.duplicate && !parseResult.exactDuplicate);

  const totalAgents = preview?.rows.length ?? 0;
  const selectedCount = selectionDraft.size;

  const unresolved = useMemo(() => {
    if (!preview) return 0;
    return preview.rows.filter((row) => {
      if (!selectionDraft.has(row.normalizedName)) return false;
      if (row.match.status === "exact" && row.match.agentId) return false;
      return !mappingDraft[row.normalizedName];
    }).length;
  }, [preview, mappingDraft, selectionDraft]);

  function toggleAgentSelection(normalizedName: string, checked: boolean) {
    setSelectionDraft((prev) => {
      const next = new Set(prev);
      if (checked) next.add(normalizedName);
      else next.delete(normalizedName);
      return next;
    });
  }

  function selectAllAgents() {
    if (!preview) return;
    setSelectionDraft(new Set(preview.rows.map((r) => r.normalizedName)));
  }

  function deselectAllAgents() {
    setSelectionDraft(new Set());
  }

  function closeDialog(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setStep("upload");
      setParseResult(null);
      setSelectionDraft(new Set());
    }
  }

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="flex max-h-[min(92vh,880px)] w-[min(96vw,72rem)] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <DialogTitle>Import Freshdesk PDF</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="import" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-6 mt-4 w-fit shrink-0">
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="mt-0 flex min-h-0 flex-1 flex-col px-6 pb-6 pt-4 data-[state=inactive]:hidden">
            {step === "upload" ? (
              <div className="space-y-3">
                <Label htmlFor="kpi-pdf-upload">Freshdesk Agent Performance PDF (weekly or monthly)</Label>
                <Input
                  id="kpi-pdf-upload"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) parseMutation.mutate(file);
                    e.target.value = "";
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Preview mirrors Freshdesk sections: Activity, Time, SLA Performance, and CSAT. Apply updates mapped Hub KPI
                  fields only — use the Changes tab before replacing an existing import.
                </p>
              </div>
            ) : null}

            {step === "preview" && parseResult && preview ? (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="shrink-0 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      <span className="text-muted-foreground">Period:</span> {parseResult.import.periodType}{" "}
                      {parseResult.import.periodStart} – {parseResult.import.periodEnd}
                    </span>
                    <span>
                      <span className="text-muted-foreground">Generated:</span> {parseResult.import.reportGeneratedAt}
                    </span>
                    <span>
                      <span className="text-muted-foreground">Filter:</span> {parseResult.import.reportingFilter}
                      {!parseResult.import.periodCompleteAtGeneration ? " (partial at generation)" : ""}
                    </span>
                  </div>
                  {preview.warnings.length ? (
                    <ul className="mt-2 list-disc pl-4 text-amber-700 dark:text-amber-400">
                      {preview.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                {unresolved > 0 ? (
                  <p className="shrink-0 text-sm text-amber-700 dark:text-amber-400">
                    {unresolved} selected agent(s) need a Hub mapping before apply.
                  </p>
                ) : null}

                <KpiFreshdeskImportPreviewTable
                  rows={preview.rows}
                  selectionDraft={selectionDraft}
                  agents={agents}
                  mappingDraft={mappingDraft}
                  onToggleSelection={toggleAgentSelection}
                  onMappingChange={(normalizedName, agentId) =>
                    setMappingDraft((prev) => ({ ...prev, [normalizedName]: agentId }))
                  }
                  onSelectAll={selectAllAgents}
                  onDeselectAll={deselectAllAgents}
                  selectedCount={selectedCount}
                  totalAgents={totalAgents}
                />

                <div className="shrink-0 space-y-3 border-t pt-3">
                  {needsReplaceConfirm ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={confirmReplace}
                        onChange={(e) => setConfirmReplace(e.target.checked)}
                      />
                      Replace existing imported data for this reporting period
                    </label>
                  ) : null}

                  <DialogFooter className="gap-2 px-0 sm:justify-between">
                    <Button type="button" variant="outline" onClick={() => setStep("upload")}>
                      Upload different file
                    </Button>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={mappingsMutation.isPending}
                        onClick={() => mappingsMutation.mutate()}
                      >
                        Save mappings
                      </Button>
                      <Button
                        type="button"
                        disabled={
                          applyMutation.isPending ||
                          selectedCount === 0 ||
                          unresolved > 0 ||
                          (needsReplaceConfirm && !confirmReplace)
                        }
                        onClick={() => applyMutation.mutate()}
                      >
                        Apply import
                      </Button>
                    </div>
                  </DialogFooter>
                </div>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="history" className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4 data-[state=inactive]:hidden">
            {historyQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
            {historyQuery.data?.imports.length ? (
              <ul className="space-y-2 text-sm">
                {historyQuery.data.imports.map((item) => (
                  <li key={item.id} className="rounded-md border p-2">
                    <div className="font-medium">{item.originalFilename}</div>
                    <div className="text-muted-foreground">
                      {item.periodType} {item.periodStart} – {item.periodEnd} · {item.status}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No imports yet.</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
