import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/bits";
import { HandbookBreadcrumbs, type BreadcrumbItem } from "./HandbookBreadcrumbs";
import { HandbookMetaBar } from "./HandbookMetaBar";
import { HandbookProse } from "./HandbookProse";
import { HandbookToc } from "./HandbookToc";
import { HandbookFigure } from "./HandbookFigure";
import { extractTocFromMarkdown } from "@/handbook/lib/toc";
import type { LoadedHandbookDoc } from "@/handbook/lib/load-content";

type NavLink = { label: string; to: string };

type HandbookArticleProps = {
  doc: LoadedHandbookDoc;
  breadcrumbs: BreadcrumbItem[];
  prev?: NavLink;
  next?: NavLink;
  headerExtra?: ReactNode;
  showSampleFigure?: boolean;
};

export function HandbookArticle({
  doc,
  breadcrumbs,
  prev,
  next,
  headerExtra,
  showSampleFigure = false,
}: HandbookArticleProps) {
  const toc = extractTocFromMarkdown(doc.body);

  return (
    <article>
      <HandbookBreadcrumbs items={breadcrumbs} />
      <PageHeader title={doc.title} description={doc.description} />
      <div className="mb-6 space-y-2">
        <HandbookMetaBar />
        {headerExtra}
      </div>

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 xl:max-w-3xl">
          {showSampleFigure ? (
            <HandbookFigure
              alt="Example annotated screenshot placement for a future walkthrough step."
              caption="M1 placeholder — real Hub screenshots will replace this in a later milestone."
            />
          ) : null}
          <HandbookProse markdown={doc.body} />
          {(prev || next) && (
            <div className="mt-10 flex flex-wrap gap-3 border-t border-border/70 pt-6">
              {prev ? (
                <Button variant="outline" size="sm" asChild>
                  <Link to={prev.to}>← {prev.label}</Link>
                </Button>
              ) : null}
              {next ? (
                <Button variant="outline" size="sm" asChild className="ml-auto">
                  <Link to={next.to}>{next.label} →</Link>
                </Button>
              ) : null}
            </div>
          )}
        </div>
        {toc.length > 0 ? (
          <aside className="w-full shrink-0 xl:w-56 xl:sticky xl:top-28 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
            <HandbookToc entries={toc} className="rounded-xl border border-border/60 bg-muted/20 p-4" />
          </aside>
        ) : null}
      </div>
    </article>
  );
}
