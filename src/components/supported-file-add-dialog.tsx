import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileIcon, Upload, X } from "lucide-react";
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
import { api } from "@/lib/api";
import { fileToUploadPayload, formatFileSize } from "@/lib/issue-attachments";
import {
  SUPPORTED_FILE_ACCEPT,
  validateSupportedReferenceFile,
} from "@/lib/supported-file-attachment";
import { cn } from "@/lib/utils";

function ExchangeField({
  value,
  onChange,
  options,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
  invalid?: boolean;
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
        placeholder="Start typing an exchange name"
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
      <p className="text-xs text-muted-foreground">Choose an existing exchange or enter a new name.</p>
    </div>
  );
}

function ReferenceFileField({
  file,
  onChange,
  disabled,
  error,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  error: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function selectNext(next: File | null) {
    onChange(next);
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="sf-add-reference-file">Sample / reference file (optional)</Label>
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
            if (dropped) selectNext(dropped);
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
              const next = e.target.files?.[0] ?? null;
              selectNext(next);
              e.target.value = "";
            }}
          />
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
            <p className="text-center text-xs text-muted-foreground sm:text-left">
              CSV, PDF, Excel, images, or plain text · up to 12 MB
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
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label="Remove file"
            onClick={() => onChange(null)}
          >
            <X className="size-4" />
          </Button>
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
  const [fileName, setFileName] = useState("");
  const [updatedReason, setUpdatedReason] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const exchanges = useQuery({
    queryKey: ["supported-files-exchanges"],
    queryFn: () => api<{ exchanges: string[] }>("/api/supported-files/exchanges"),
    enabled: open,
  });

  function resetForm() {
    setExchangeName("");
    setFileName("");
    setUpdatedReason("");
    setPendingFile(null);
    setFileError(null);
    setSubmitAttempted(false);
    setFormError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  function handleFileChange(file: File | null) {
    if (!file) {
      setPendingFile(null);
      setFileError(null);
      return;
    }
    const message = validateSupportedReferenceFile(file);
    if (message) {
      setPendingFile(null);
      setFileError(message);
      return;
    }
    setPendingFile(file);
    setFileError(null);
  }

  const create = useMutation({
    mutationFn: async () => {
      setFormError(null);
      const created = await api<{ item: { id: string } }>("/api/supported-files", {
        method: "POST",
        body: JSON.stringify({
          exchangeName: exchangeName.trim(),
          fileName: fileName.trim(),
          updatedReason,
        }),
      });
      const newId = created.item.id;
      if (pendingFile) {
        const payload = await fileToUploadPayload(pendingFile);
        await api(`/api/supported-files/${newId}/attachment`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      return newId;
    },
    onSuccess: () => {
      toast.success("Supported file added");
      handleOpenChange(false);
      void client.invalidateQueries({ queryKey: ["supported-files-list"] });
      void client.invalidateQueries({ queryKey: ["supported-files-dashboard"] });
      void client.invalidateQueries({ queryKey: ["supported-files-exchanges"] });
    },
    onError: (e: Error) => {
      const msg = e.message || "Could not create supported file";
      if (msg.includes("already exists")) {
        setFormError(msg);
      } else {
        toast.error(msg);
      }
    },
  });

  const exchangeInvalid = submitAttempted && !exchangeName.trim();
  const fileNameInvalid = submitAttempted && !fileName.trim();
  const canSubmit = Boolean(exchangeName.trim() && fileName.trim() && !fileError);

  function submit() {
    setSubmitAttempted(true);
    setFormError(null);
    if (!canSubmit || create.isPending) return;
    create.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,560px)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 py-4 text-left">
          <DialogTitle>Add supported file</DialogTitle>
          <DialogDescription className="text-pretty text-sm leading-snug">
            Add a file type for an exchange. You can attach a sample file now and verify the details later from the tracker.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <ExchangeField
            value={exchangeName}
            onChange={setExchangeName}
            options={exchanges.data?.exchanges ?? []}
            disabled={create.isPending}
            invalid={exchangeInvalid}
          />
          {exchangeInvalid ? <p className="-mt-2 text-xs text-destructive">Exchange is required.</p> : null}

          <div className="space-y-1.5">
            <Label htmlFor="sf-add-file-type">
              Supported file type <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sf-add-file-type"
              value={fileName}
              disabled={create.isPending}
              aria-invalid={fileNameInvalid || undefined}
              placeholder="e.g. Trade History"
              className={cn(fileNameInvalid && "border-destructive focus-visible:ring-destructive/30")}
              onChange={(e) => setFileName(e.target.value)}
            />
            {fileNameInvalid ? <p className="text-xs text-destructive">Supported file type is required.</p> : null}
          </div>

          <ReferenceFileField
            file={pendingFile}
            onChange={handleFileChange}
            disabled={create.isPending}
            error={fileError}
          />

          <div className="space-y-1.5">
            <Label htmlFor="sf-add-notes">Notes (optional)</Label>
            <Textarea
              id="sf-add-notes"
              rows={2}
              disabled={create.isPending}
              value={updatedReason}
              onChange={(e) => setUpdatedReason(e.target.value)}
              className="min-h-[4.5rem] resize-y"
            />
            <p className="text-xs text-muted-foreground">
              Context about this sample or the supported-file requirement. Stored on the record for your team.
            </p>
          </div>

          {formError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-5 py-3 sm:justify-end">
          <Button type="button" variant="ghost" disabled={create.isPending} onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit || create.isPending} onClick={submit}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
