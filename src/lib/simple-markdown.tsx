import type { ReactNode } from "react";

function inline(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-700 underline" target="_blank" rel="noreferrer">$1</a>');
}

export function SimpleMarkdown({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  const lines = content.split("\n");
  let list: string[] = [];
  let ordered = false;
  let code: string[] = [];

  function flushList() {
    if (!list.length) return;
    const Tag = ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={`my-3 ${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-6`}>
        {list.map((item) => (
          <li key={item} dangerouslySetInnerHTML={{ __html: inline(item) }} />
        ))}
      </Tag>,
    );
    list = [];
    ordered = false;
  }

  function flushCode() {
    if (!code.length) return;
    blocks.push(
      <pre key={blocks.length} className="my-4 overflow-x-auto rounded-lg bg-slate-950 px-4 py-3 text-sm text-slate-100">
        <code>{code.join("\n")}</code>
      </pre>,
    );
    code = [];
  }

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (code.length) flushCode();
      else code = [];
      continue;
    }
    if (code.length || line.startsWith("```")) {
      code.push(line);
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      flushCode();
      ordered = true;
      list.push(line.replace(/^\d+\.\s/, ""));
      continue;
    }
    if (line.startsWith("- ")) {
      flushCode();
      list.push(line.slice(2));
      continue;
    }
    flushList();
    flushCode();
    if (!line.trim()) continue;
    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={blocks.length} className="mt-6 mb-2 text-xl font-semibold text-slate-900">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={blocks.length} className="mt-6 mb-2 text-2xl font-semibold text-slate-900">
          {line.slice(2)}
        </h1>,
      );
    } else {
      blocks.push(<p key={blocks.length} className="my-2 leading-7 text-slate-700" dangerouslySetInnerHTML={{ __html: inline(line) }} />);
    }
  }
  flushList();
  flushCode();
  return <div className="prose-slate max-w-none">{blocks}</div>;
}
