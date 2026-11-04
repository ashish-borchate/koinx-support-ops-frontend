import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileIcon, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { fileToUploadPayload, formatFileSize } from "@/lib/issue-attachments";
import {
  SUPPORTED_FILE_ACCEPT,
  SUPPORTED_FILE_FORMAT_HINT,
  SUPPORTED_FILE_MAX_BYTES,
  validateSupportedReferenceFile,
} from "@/lib/supported-file-attachment";
import {
  applyBatchResultsToDrafts,
  formatBatchEntryFailureMessage,
  summarizeBatchResults,
  validateSupportedFileDrafts,
  type BatchApiResultItem,
  type SupportedFileDraftEntry,
} from "@/lib/supported-file-batch";
import { cn } from "@/lib/utils";

function newDraftEntry(): SupportedFileDraftEntry {
  return {
    id: crypto.randomUUID(),
    fileName: "",
    notes: "",
    referenceFile: null,
    fileError: null,
  };
}

function ExchangeField({
  value,
  onChange,
  options,
  disabled,
  invalid,
  existingMatch,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
  invalid?: boolean;
  existingMatch?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = q ? options.filter((name) => name.toLowerCase().includes(q)) : options;
    return list.slice(0, 10);
  }, [options, value]);

  return (
    <div className="relative space-y-1.5">
      <Label htmlFor="sf-add-exchange">
        Exchange <span className="text-destructive">*</span>
      </Label>
      <Input
        id="sf-add-exchange"
        value={value}
        disabled={disabled}
        autoComplete="off"
        aria-invalid={invalid || undefined}
        aria-expanded={open && filtered.length > 0}
        aria-autocomplete="list"
        aria-controls="sf-add-exchange-list"
        placeholder="Search or enter an exchange name"
        className={cn(invalid && "border-destructive focus-visible:ring-destructive/30")}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 ? (
        <ul
          id="sf-add-exchange-list"
          role="listbox"
          className="absolute z-20 mt-1 max-h-36 w-full overflow-auto rounded-md border border-border bg-popover py-1 shadow-md"
        >
          {filtered.map((name) => (
            <li key={name} role="option">
              <button
                type="button"
                className="flex w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(name);
                  setOpen(false);
                }}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {existingMatch ? (
        <p className="text-xs text-muted-foreground">
          Adds files to the existing exchange <span className="font-medium text-foreground">{existingMatch}</span>.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Choose an existing exchange or enter a new name.</p>
      )}
    </div>
  );
}

function ReferenceFileField({
  file,
  onChange,
  disabled,
  error,
  required,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  error: string | null;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function pick(next: File | null) {
    onChange(next);
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="sf-add-reference-file">
        Reference file {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {!file ? (
        <div
          className={cn(
            "rounded-lg border border-dashed border-border/80 bg-muted/15 px-3 py-3 transition-colors",
            dragOver && "border-primary/45 bg-primary/5",
            disabled && "opacity-60",
            error && "border-destructive/50",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (disabled) return;
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) pick(dropped);
          }}
        >
          <input
            ref={inputRef}
            id="sf-add-reference-file"
            type="file"
            accept={SUPPORTED_FILE_ACCEPT}
            className="sr-only"
            disabled={disabled}
            onChange={(e) => {
              pick(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
            <p className="text-center text-xs text-muted-foreground sm:text-left">
              {SUPPORTED_FILE_FORMAT_HINT} · up to {Math.round(SUPPORTED_FILE_MAX_BYTES / (1024 * 1024))} MB
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              className="shrink-0 gap-1.5"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-3.5 opacity-70" aria-hidden />
              Browse
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
          <FileIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground" title={file.name}>
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          <div className="flex shrink-0 gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              className="h-8 px-2 text-xs"
              onClick={() => inputRef.current?.click()}
            >
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              aria-label="Remove file"
              onClick={() => pick(null)}
            >
              <X className="size-4" />
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={SUPPORTED_FILE_ACCEPT}
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              pick(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </div>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function AddSupportedFileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const client = useQueryClient();
  const [exchangeName, setExchangeName] = useState("");
  const [entries, setEntries] = useState<SupportedFileDraftEntry[]>(() => [newDraftEntry()]);
  const [activeId, setActiveId] = useState<string>(() => entries[0]?.id ?? "");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const tabListRef = useRef<HTMLDivElement>(null);

  const exchanges = useQuery({
    queryKey: ["supported-files-exchanges"],
    queryFn: () => api<{ exchanges: string[] }>("/api/supported-files/exchanges"),
    enabled: open,
  });

  const existingExchangeMatch = useMemo(() => {
    const trimmed = exchangeName.trim().toLowerCase();
    if (!trimmed) return null;
    return exchanges.data?.exchanges.find((name) => name.toLowerCase() === trimmed) ?? null;
  }, [exchangeName, exchanges.data?.exchanges]);

  const activeEntry = entries.find((e) => e.id === activeId) ?? entries[0];

  const resetForm = useCallback(() => {
    const first = newDraftEntry();
    setExchangeName("");
    setEntries([first]);
    setActiveId(first.id);
    setSubmitAttempted(false);
    setBatchMessage(null);
  }, []);

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  function updateEntry(id: string, patch: Partial<SupportedFileDraftEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function handleReferenceChange(id: string, file: File | null) {
    if (!file) {
      updateEntry(id, { referenceFile: null, fileError: null });
      return;
    }
    const message = validateSupportedReferenceFile(file);
    if (message) {
      updateEntry(id, { referenceFile: null, fileError: message });
      return;
    }
    updateEntry(id, { referenceFile: file, fileError: null });
  }

  function addEntry() {
    const entry = newDraftEntry();
    setEntries((prev) => [...prev, entry]);
    setActiveId(entry.id);
    window.requestAnimationFrame(() => {
      tabListRef.current?.scrollTo({ left: tabListRef.current.scrollWidth, behavior: "smooth" });
    });
  }

  function entryHasContent(entry: SupportedFileDraftEntry) {
    return Boolean(entry.fileName.trim() || entry.notes.trim() || entry.referenceFile || entry.createdId);
  }

  function removeEntry(id: string) {
    const entry = entries.find((e) => e.id === id);
    if (!entry || entry.createdId) return;
    if (entries.length <= 1) return;
    if (entryHasContent(entry)) {
      const ok = window.confirm("Remove this file entry? Unsaved information will be lost.");
      if (!ok) return;
    }
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    if (activeId === id) setActiveId(next[0]?.id ?? "");
  }

  const validation = useMemo(
    () => validateSupportedFileDrafts(exchangeName, entries),
    [exchangeName, entries, submitAttempted],
  );

  const pendingCount = entries.filter((e) => !e.createdId).length;

  const createBatch = useMutation({
    mutationFn: async () => {
      setBatchMessage(null);
      const pending = entries.filter((e) => !e.createdId);
      const payload = {
        exchangeName: exchangeName.trim(),
        files: await Promise.all(
          pending.map(async (entry) => ({
            fileName: entry.fileName.trim(),
            updatedReason: entry.notes,
            attachment: await fileToUploadPayload(entry.referenceFile!),
          })),
        ),
      };
      return api<{
        exchangeName: string;
        created: number;
        failed: number;
        results: BatchApiResultItem[];
      }>("/api/supported-files/batch", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      const nextEntries = applyBatchResultsToDrafts(entries, data.results);
      setEntries(nextEntries);
      void client.invalidateQueries({ queryKey: ["supported-files-list"] });
      void client.invalidateQueries({ queryKey: ["supported-files-dashboard"] });
      void client.invalidateQueries({ queryKey: ["supported-files-exchanges"] });

      const { created, failed } = summarizeBatchResults(data.results);
      if (failed === 0) {
        toast.success(
          created === 1 ? "Supported file created" : `${created} supported files created for ${data.exchangeName}`,
        );
        handleOpenChange(false);
        return;
      }
      const lines = data.results
        .filter((r) => !r.ok)
        .map((r) => formatBatchEntryFailureMessage(r))
        .join(" · ");
      setBatchMessage(`${created} created, ${failed} failed. ${lines}`);
      toast.warning(`${created} of ${created + failed} supported files were created. Fix the remaining entries and retry.`);
      const firstFail = data.results.find((r) => !r.ok);
      if (firstFail) {
        const match = nextEntries.find(
          (e) => e.fileName.trim().toLowerCase() === firstFail.fileName.trim().toLowerCase(),
        );
        if (match) setActiveId(match.id);
      }
    },
    onError: (e: Error) => {
      if (e instanceof ApiError) {
        const validationErrors = e.payload?.validationErrors;
        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
          setBatchMessage(
            validationErrors.map((v: { fileName: string; error: string }) => `${v.fileName}: ${v.error}`).join(" · "),
          );
          return;
        }
        if (e.payload?.batch) {
          const batch = e.payload.batch as {
            results: BatchApiResultItem[];
            created: number;
            failed: number;
          };
          setEntries((prev) => applyBatchResultsToDrafts(prev, batch.results));
          setBatchMessage(e.message);
          return;
        }
      }
      toast.error(e.message || "Could not create supported files");
    },
  });

  function submit() {
    setSubmitAttempted(true);
    const v = validateSupportedFileDrafts(exchangeName, entries);
    if (v.exchangeError || v.firstInvalidEntryId) {
      if (v.firstInvalidEntryId) setActiveId(v.firstInvalidEntryId);
      return;
    }
    if (pendingCount === 0) {
      handleOpenChange(false);
      return;
    }
    if (createBatch.isPending) return;
    createBatch.mutate();
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!tabListRef.current?.contains(document.activeElement)) return;
      const idx = entries.findIndex((en) => en.id === activeId);
      if (e.key === "ArrowRight" && idx >= 0 && idx < entries.length - 1) {
        e.preventDefault();
        setActiveId(entries[idx + 1].id);
      }
      if (e.key === "ArrowLeft" && idx > 0) {
        e.preventDefault();
        setActiveId(entries[idx - 1].id);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, entries, activeId]);

  const exchangeInvalid = submitAttempted && Boolean(validation.exchangeError);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,640px)] max-w-[min(100vw-1rem,42rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 py-4 text-left">
          <DialogTitle>Add supported files</DialogTitle>
          <DialogDescription className="text-pretty text-sm leading-snug">
            Add an exchange and attach a reference file for each supported file format. You can review and verify each file
            separately.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ExchangeField
            value={exchangeName}
            onChange={setExchangeName}
            options={exchanges.data?.exchanges ?? []}
            disabled={createBatch.isPending}
            invalid={exchangeInvalid}
            existingMatch={existingExchangeMatch}
          />
          {exchangeInvalid ? <p className="mt-1 text-xs text-destructive">{validation.exchangeError}</p> : null}

          <div className="mt-5 space-y-3">
            <div
              ref={tabListRef}
              role="tablist"
              aria-label="Supported file entries"
              className="-mx-1 flex gap-1 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:thin]"
            >
              {entries.map((entry) => {
                const errs = validation.entryErrors[entry.id];
                const hasError = submitAttempted && Boolean(errs && Object.keys(errs).length > 0);
                const label = entry.fileName.trim() || "New file";
                const selected = entry.id === activeId;
                return (
                  <div key={entry.id} className="flex shrink-0 items-stretch">
                    <button
                      type="button"
                      role="tab"
                      id={`sf-tab-${entry.id}`}
                      aria-selected={selected}
                      aria-controls={`sf-panel-${entry.id}`}
                      title={label}
                      disabled={createBatch.isPending}
                      className={cn(
                        "max-w-[9.5rem] truncate rounded-l-lg border border-r-0 px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-muted/40 text-foreground hover:bg-muted",
                        hasError && !selected && "border-destructive/40 text-destructive",
                        entry.createdId && "opacity-70",
                      )}
                      onClick={() => setActiveId(entry.id)}
                    >
                      {entry.createdId ? "✓ " : hasError ? "· " : null}
                      {label}
                    </button>
                    {entries.length > 1 && !entry.createdId ? (
                      <button
                        type="button"
                        aria-label={`Remove ${label}`}
                        disabled={createBatch.isPending}
                        className={cn(
                          "rounded-r-lg border px-1.5 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30",
                        )}
                        onClick={() => removeEntry(entry.id)}
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : (
                      <span
                        className={cn(
                          "w-px rounded-r-lg border border-l-0",
                          selected ? "border-primary/40 bg-primary/10" : "border-border bg-muted/40",
                        )}
                      />
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                role="tab"
                aria-label="Add another file"
                disabled={createBatch.isPending || entries.length >= 25}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={addEntry}
              >
                <Plus className="size-3.5" aria-hidden />
                Add file
              </button>
            </div>

            {activeEntry ? (
              <div
                role="tabpanel"
                id={`sf-panel-${activeEntry.id}`}
                aria-labelledby={`sf-tab-${activeEntry.id}`}
                className="space-y-4 rounded-xl border border-border/80 bg-card/50 p-4"
              >
                {activeEntry.createdId ? (
                  <p className="text-sm text-emerald-800 dark:text-emerald-200">
                    This supported file was created. Remove it from the batch or close the dialog.
                  </p>
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="sf-add-file-name">
                    Supported file name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sf-add-file-name"
                    value={activeEntry.fileName}
                    disabled={createBatch.isPending || Boolean(activeEntry.createdId)}
                    aria-invalid={submitAttempted && validation.entryErrors[activeEntry.id]?.fileName ? true : undefined}
                    placeholder="e.g. Trade History"
                    className={cn(
                      submitAttempted &&
                        validation.entryErrors[activeEntry.id]?.fileName &&
                        "border-destructive focus-visible:ring-destructive/30",
                    )}
                    onChange={(e) => updateEntry(activeEntry.id, { fileName: e.target.value })}
                  />
                  {submitAttempted && validation.entryErrors[activeEntry.id]?.fileName ? (
                    <p className="text-xs text-destructive">{validation.entryErrors[activeEntry.id]?.fileName}</p>
                  ) : null}
                </div>

                {!activeEntry.createdId ? (
                  <ReferenceFileField
                    file={activeEntry.referenceFile}
                    onChange={(file) => handleReferenceChange(activeEntry.id, file)}
                    disabled={createBatch.isPending}
                    required
                    error={
                      activeEntry.fileError ||
                      (submitAttempted ? validation.entryErrors[activeEntry.id]?.reference ?? null : null)
                    }
                  />
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="sf-add-notes">Notes (optional)</Label>
                  <Textarea
                    id="sf-add-notes"
                    rows={2}
                    disabled={createBatch.isPending || Boolean(activeEntry.createdId)}
                    value={activeEntry.notes}
                    onChange={(e) => updateEntry(activeEntry.id, { notes: e.target.value })}
                    className="min-h-[4rem] resize-y"
                  />
                </div>
              </div>
            ) : null}

          </div>

          {batchMessage ? (
            <p className="mt-4 rounded-md border border-amber-300/50 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" role="status">
              {batchMessage}
            </p>
          ) : null}
        </div>

        <DialogFooter className="sticky bottom-0 shrink-0 gap-2 border-t border-border/60 bg-background px-5 py-3 sm:justify-end">
          <Button type="button" variant="ghost" disabled={createBatch.isPending} onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={createBatch.isPending || pendingCount === 0} onClick={submit}>
            {createBatch.isPending ? "Creating…" : pendingCount <= 1 ? "Create supported files" : `Create supported files (${pendingCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
