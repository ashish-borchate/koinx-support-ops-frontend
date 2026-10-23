import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending?: boolean;
  onConfirm: () => void;
};

export function ConfirmMintlifyUpdatesDialog({ open, onOpenChange, pending, onConfirm }: Props) {
  const [checked, setChecked] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setChecked(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm Mintlify Updates</DialogTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Before proceeding to documentation verification, please confirm that all required changes have been completed
            in Mintlify.
          </p>
        </DialogHeader>
        <label className="flex items-start gap-2 text-sm leading-snug">
          <input
            type="checkbox"
            className="mt-1"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>
            I have updated the documentation in Mintlify and confirmed that all required changes, instructions, and
            screenshots are complete.
          </span>
        </label>
        <p className="text-xs text-muted-foreground">
          The Hub cannot automatically verify changes made in Mintlify. Your confirmation will mark the documentation as
          ready for verification and start the 24-hour verification SLA.
        </p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={!checked || pending} onClick={onConfirm}>
            {pending ? "Confirming…" : "Confirm & Proceed to Verification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
