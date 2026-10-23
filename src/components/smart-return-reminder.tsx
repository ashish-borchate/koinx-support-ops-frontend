import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  clearExternalEditSession,
  dismissExternalEditSession,
  readExternalEditSession,
  type ExternalEditSession,
} from "@/lib/external-edit-session";

type Props = {
  recordId: string;
  kind: ExternalEditSession["kind"];
  source: "Mintlify" | "Notion";
  readOnly?: boolean;
  onVerify?: () => void;
};

export function SmartReturnReminder({ recordId, kind, source, readOnly, onVerify }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<ExternalEditSession | null>(null);

  useEffect(() => {
    if (readOnly) return;
    const maybeOpen = () => {
      if (document.visibilityState !== "visible") return;
      const s = readExternalEditSession();
      if (!s || s.dismissed || s.recordId !== recordId || s.kind !== kind) return;
      setSession(s);
      setOpen(true);
    };
    maybeOpen();
    document.addEventListener("visibilitychange", maybeOpen);
    window.addEventListener("focus", maybeOpen);
    return () => {
      document.removeEventListener("visibilitychange", maybeOpen);
      window.removeEventListener("focus", maybeOpen);
    };
  }, [recordId, kind, readOnly]);

  const title = source === "Notion" ? "Did you make changes in Notion?" : "Did you make changes in Mintlify?";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Choose what you&apos;d like to do next with this documentation update.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-center"
            onClick={() => {
              dismissExternalEditSession();
              setOpen(false);
            }}
          >
            Still working
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-center"
            onClick={() => {
              clearExternalEditSession();
              setOpen(false);
              onVerify?.();
            }}
          >
            Changes complete — verify
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-center"
            onClick={() => {
              clearExternalEditSession();
              setOpen(false);
            }}
          >
            No changes made
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-center"
            onClick={() => {
              dismissExternalEditSession();
              setOpen(false);
            }}
          >
            Remind me later
          </Button>
          {session && session.recordId !== recordId ? (
            <Button
              type="button"
              variant="link"
              onClick={() => {
                setOpen(false);
                navigate(kind === "product_guide" ? `/product-guides/${session.recordId}` : `/integration-steps/${session.recordId}`);
              }}
            >
              Go to document you were editing
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
