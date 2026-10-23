import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ChecklistItemDef, VerificationAnswer, VerificationChecklistPayload } from "@/lib/integration-review-checklist";
import { GuideUpdateReasonFields } from "@/components/guide-update-reason-fields";
import { IntegrationUpdateReasonFields } from "@/components/integration-update-reason-fields";
import { isGuideUpdateReasonReadyForPublish } from "@/lib/guide-update-reason";
import { isIntegrationUpdateReasonReadyForPublish } from "@/lib/integration-update-reason";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  items: readonly ChecklistItemDef[] | ChecklistItemDef[];
  allowUnable?: boolean;
  pending?: boolean;
  supportedFilesHref?: string;
  confirmLabel: string;
  updateReason?: {
    variant: "integration" | "guide";
    value: string;
    onChange: (value: string) => void;
  };
  onConfirm: (checklist: VerificationChecklistPayload, extras?: { updateReason?: string }) => void;
};

function isComplete(items: ChecklistItemDef[], checklist: VerificationChecklistPayload, allowUnable: boolean) {
  return items.every((item) => {
    const entry = checklist[item.id];
    if (!entry) return false;
    if (entry.result === "unable") return !allowUnable;
    if (entry.result === "verified") return true;
    if (entry.result === "na") {
      if (!item.allowsNa) return false;
      return Boolean(entry.naReason?.trim());
    }
    return false;
  });
}

export function VerificationChecklistDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  items,
  allowUnable = true,
  pending,
  supportedFilesHref,
  confirmLabel,
  updateReason,
  onConfirm,
}: Props) {
  const itemList = useMemo(() => [...items], [items]);
  const [checklist, setChecklist] = useState<VerificationChecklistPayload>({});
  const [reasonError, setReasonError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setChecklist({});
      setReasonError(null);
    }
  }, [open]);

  const complete = useMemo(() => isComplete(itemList, checklist, allowUnable), [itemList, checklist, allowUnable]);
  const hasUnable = itemList.some((i) => checklist[i.id]?.result === "unable");

  function setResult(id: string, result: VerificationAnswer["result"]) {
    setChecklist((prev) => ({
      ...prev,
      [id]: { result, naReason: result === "na" ? prev[id]?.naReason || "" : undefined },
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? <p className="text-sm font-normal text-muted-foreground">{subtitle}</p> : null}
        </DialogHeader>
        {supportedFilesHref ? (
          <p className="text-sm text-muted-foreground">
            Reference files:{" "}
            <Link to={supportedFilesHref} className="font-medium text-primary hover:underline">
              Supported Files for this exchange
            </Link>
          </p>
        ) : null}
        {updateReason ? (
          <div className="space-y-1">
            {updateReason.variant === "guide" ? (
              <GuideUpdateReasonFields
                value={updateReason.value}
                onChange={(v) => {
                  updateReason.onChange(v);
                  setReasonError(null);
                }}
                required
              />
            ) : (
              <IntegrationUpdateReasonFields
                value={updateReason.value}
                onChange={(v) => {
                  updateReason.onChange(v);
                  setReasonError(null);
                }}
                required
              />
            )}
            {reasonError ? <p className="text-sm text-destructive">{reasonError}</p> : null}
          </div>
        ) : null}
        <ul className="grid gap-3 sm:grid-cols-2">
          {itemList.map((item) => {
            const entry = checklist[item.id];
            const isNa = entry?.result === "na";
            const groupName = `checklist-${item.id}`;
            return (
              <li key={item.id} className="space-y-2 rounded-lg border border-border/70 p-3">
                <p className="text-sm leading-snug">{item.label}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name={groupName}
                      checked={entry?.result === "verified"}
                      onChange={() => setResult(item.id, "verified")}
                    />
                    Verified
                  </label>
                  {item.allowsNa ? (
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name={groupName}
                        checked={isNa}
                        onChange={() => setResult(item.id, "na")}
                      />
                      Not applicable
                    </label>
                  ) : null}
                  {allowUnable ? (
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name={groupName}
                        checked={entry?.result === "unable"}
                        onChange={() => setResult(item.id, "unable")}
                      />
                      Unable to verify
                    </label>
                  ) : null}
                </div>
                {isNa ? (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Why is this not applicable?</Label>
                    <Textarea
                      rows={2}
                      value={entry?.naReason || ""}
                      onChange={(e) =>
                        setChecklist((p) => ({ ...p, [item.id]: { result: "na", naReason: e.target.value } }))
                      }
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {hasUnable ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Unable to verify blocks approval. Use Request changes if you cannot complete verification.
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="button"
            disabled={!complete || pending}
            onClick={() => {
              if (updateReason) {
                const ok =
                  updateReason.variant === "guide"
                    ? isGuideUpdateReasonReadyForPublish(updateReason.value)
                    : isIntegrationUpdateReasonReadyForPublish(updateReason.value);
                if (!ok) {
                  setReasonError("Select a reason for this update before verifying.");
                  return;
                }
              }
              onConfirm(checklist, updateReason ? { updateReason: updateReason.value } : undefined);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
