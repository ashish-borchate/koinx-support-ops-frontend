import { useMemo } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { buildHeadingIdAssigner } from "@/handbook/lib/heading-ids";
import { cn } from "@/lib/utils";
import { HandbookCallout, type CalloutVariant } from "./HandbookCallout";

function calloutFromBlockquote(children: React.ReactNode): { variant: CalloutVariant; title?: string; body: React.ReactNode } | null {
  const flat = String(children);
  const match = /^\s*(Note|Tip|Important|Warning)\s*:\s*(.*)/is.exec(flat.replace(/\n/g, " "));
  if (!match) return null;
  const map: Record<string, CalloutVariant> = { note: "note", tip: "tip", important: "important", warning: "warning" };
  const variant = map[match[1].toLowerCase()];
  if (!variant) return null;
  return { variant, title: match[1], body: match[2] || children };
}

function makeComponents(nextId: (level: 2 | 3, text: string) => string): Components {
  return {
    h2: ({ children }) => {
      const text = String(children);
      const id = nextId(2, text);
      return (
        <h2 id={id} className="scroll-mt-28 text-xl font-semibold tracking-tight text-foreground mt-10 mb-3 first:mt-0">
          {children}
        </h2>
      );
    },
    h3: ({ children }) => {
      const text = String(children);
      const id = nextId(3, text);
      return (
        <h3 id={id} className="scroll-mt-28 text-base font-semibold text-foreground mt-6 mb-2">
          {children}
        </h3>
      );
    },
    p: ({ children }) => <p className="mb-4 leading-relaxed text-foreground/90">{children}</p>,
    ul: ({ children }) => <ul className="mb-4 list-disc space-y-1.5 pl-5 text-foreground/90">{children}</ul>,
    ol: ({ children }) => (
      <ol className="my-4 list-decimal space-y-2 pl-5 text-foreground/90 [&>li]:pl-1">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    a: ({ href, children }) => {
      if (href?.startsWith("/")) {
        return (
          <Link
            to={href}
            className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm"
          >
            {children}
          </Link>
        );
      }
      return (
        <a
          href={href}
          className="font-medium text-primary underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          {children}
        </a>
      );
    },
    table: ({ children }) => (
      <div className="mb-4 overflow-x-auto rounded-lg border border-border/70">
        <table className="w-full min-w-[280px] text-left text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="border-b border-border/70 bg-muted/40">{children}</thead>,
    th: ({ children }) => <th className="px-3 py-2 font-semibold text-foreground">{children}</th>,
    td: ({ children }) => <td className="border-t border-border/50 px-3 py-2 text-foreground/90">{children}</td>,
    hr: () => <hr className="my-8 border-border/70" />,
    blockquote: ({ children }) => {
      const callout = calloutFromBlockquote(children);
      if (callout) {
        return (
          <HandbookCallout variant={callout.variant} title={callout.title}>
            <p>{callout.body}</p>
          </HandbookCallout>
        );
      }
      return (
        <blockquote className="mb-4 border-l-4 border-primary/40 bg-primary/5 py-2 pl-4 text-sm text-muted-foreground">
          {children}
        </blockquote>
      );
    },
    code: ({ className, children }) => {
      const inline = !className;
      if (inline) {
        return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>;
      }
      return (
        <code className="block overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">{children}</code>
      );
    },
  };
}

type HandbookProseProps = {
  markdown: string;
  className?: string;
};

export function HandbookProse({ markdown, className }: HandbookProseProps) {
  const components = useMemo(() => {
    const assigner = buildHeadingIdAssigner(markdown);
    return makeComponents((level, text) => assigner(level, text));
  }, [markdown]);

  return (
    <div className={cn("handbook-prose max-w-none", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
