import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SimpleMarkdown } from "@/lib/simple-markdown";
import { cn } from "@/lib/utils";

const COLLAPSED_MAX_PX = 288;

function isLongGuideContent(content: string) {
  const text = content.trim();
  if (!text) return false;
  if (text.length > 700) return true;
  return text.split("\n").length > 14;
}

/** Legacy in-app content viewer — new guides use external Mintlify links only. */
export function GuideContentViewer({ content, title = "Guide content" }: { content: string; title?: string }) {
  const [expandedOnPage, setExpandedOnPage] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const long = isLongGuideContent(content);

  useEffect(() => {
    setExpandedOnPage(false);
    setFullOpen(false);
  }, [content]);

  if (!content.trim()) {
    return <p className="text-sm text-muted-foreground">Documentation is maintained in Mintlify. Use the published link above.</p>;
  }

  const collapsed = long && !expandedOnPage;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Archived copy stored in the hub (legacy).</p>
      <div className="relative">
        <div
          className={cn(collapsed && "max-h-72 overflow-hidden")}
          style={collapsed ? { maxHeight: COLLAPSED_MAX_PX } : undefined}
        >
          <SimpleMarkdown content={content} />
        </div>
        {collapsed ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card via-card/80 to-transparent"
            aria-hidden
          />
        ) : null}
      </div>
      {long ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setExpandedOnPage((v) => !v)}>
            {expandedOnPage ? "Collapse" : "Expand on page"}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setFullOpen(true)}>
            View full content
          </Button>
        </div>
      ) : null}
      <Dialog open={fullOpen} onOpenChange={setFullOpen}>
        <DialogContent className="flex max-h-[min(85vh,900px)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <SimpleMarkdown content={content} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
