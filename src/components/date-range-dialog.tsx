import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { IstDatePicker } from "@/components/ui/ist-date-picker";

export function DateRangeDialog({
  open,
  onOpenChange,
  initialFrom,
  initialTo,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFrom: string;
  initialTo: string;
  onConfirm: (from: string, to: string) => void;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  useEffect(() => {
    if (open) {
      setFrom(initialFrom);
      setTo(initialTo);
    }
  }, [open, initialFrom, initialTo]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Select date range</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">From date</Label>
            <IstDatePicker value={from} onChange={setFrom} max={to || undefined} aria-label="From date" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">To date</Label>
            <IstDatePicker value={to} onChange={setTo} min={from || undefined} aria-label="To date" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!from && !to}
            onClick={() => {
              onConfirm(from, to);
              onOpenChange(false);
            }}
          >
            Apply range
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
