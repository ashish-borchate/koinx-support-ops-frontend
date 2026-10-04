import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  integrationId?: string;
};

export function IntegrationStepsEditor({ value, onChange, readOnly }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || "";
  }, [value]);

  const sync = useCallback(() => {
    if (ref.current) onChange(ref.current.innerHTML);
  }, [onChange]);

  const exec = (command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    sync();
  };

  const insertImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      document.execCommand("insertHTML", false, `<img src="${src}" alt="Screenshot" class="my-3 max-w-full rounded-lg border" />`);
      sync();
    };
    reader.readAsDataURL(file);
  };

  if (readOnly) {
    return (
      <article
        className="prose prose-slate max-w-none rounded-xl border bg-white p-4"
        dangerouslySetInnerHTML={{ __html: value }}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 rounded-lg border bg-slate-50 p-2">
        <Button type="button" size="sm" variant="outline" onClick={() => exec("bold")}>Bold</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => exec("italic")}>Italic</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => exec("insertUnorderedList")}>List</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => exec("insertOrderedList")}>Numbered</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => exec("formatBlock", "h3")}>Heading</Button>
        <label className="inline-flex h-8 cursor-pointer items-center rounded-md border bg-white px-2 text-xs">
          Image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) insertImage(file);
            }}
          />
        </label>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="min-h-64 rounded-xl border bg-white p-4 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-blue-200"
        onInput={sync}
        onPaste={(e) => {
          const items = e.clipboardData?.items;
          if (!items) return;
          for (const item of items) {
            if (item.type.startsWith("image/")) {
              e.preventDefault();
              const file = item.getAsFile();
              if (file) insertImage(file);
              return;
            }
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file && file.type.startsWith("image/")) insertImage(file);
        }}
      />
    </div>
  );
}
