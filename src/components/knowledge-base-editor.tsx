import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
};

export function KnowledgeBaseEditor({ value, onChange, readOnly }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || "";
  }, [value]);

  const sync = useCallback(() => {
    if (ref.current) onChange(ref.current.innerHTML);
  }, [onChange]);

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    sync();
  };

  const insertLink = () => {
    const url = window.prompt("Link URL (https://…)");
    if (!url) return;
    const label = window.prompt("Link label", url) || url;
    document.execCommand(
      "insertHTML",
      false,
      `<a href="${url.replace(/"/g, "&quot;")}" target="_blank" rel="noreferrer noopener">${label}</a>`,
    );
    sync();
  };

  const insertTable = () => {
    document.execCommand(
      "insertHTML",
      false,
      "<table><thead><tr><th>Column</th><th>Column</th></tr></thead><tbody><tr><td></td><td></td></tr></tbody></table>",
    );
    sync();
  };

  const insertPre = () => {
    document.execCommand("insertHTML", false, "<pre><code></code></pre>");
    sync();
  };

  if (readOnly) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-2">
        <Button type="button" size="sm" variant="outline" onClick={() => exec("bold")}>
          Bold
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => exec("italic")}>
          Italic
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => exec("formatBlock", "h2")}>
          Heading
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => exec("formatBlock", "h3")}>
          Subheading
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => exec("insertUnorderedList")}>
          Bullets
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => exec("insertOrderedList")}>
          Numbered
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={insertLink}>
          Link
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={insertTable}>
          Table
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={insertPre}>
          Code block
        </Button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[420px] rounded-xl border border-border bg-card p-6 text-[15px] leading-7 outline-none focus:ring-2 focus:ring-blue-200"
        onInput={sync}
        onPaste={() => setTimeout(sync, 0)}
      />
      <p className="text-xs text-muted-foreground">Paste from Notion or other editors — formatting is preserved where possible and sanitized on save.</p>
    </div>
  );
}
