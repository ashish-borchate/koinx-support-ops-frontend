import { useEffect } from "react";
import { HandbookProse } from "./HandbookProse";
import { HandbookMetaBar } from "./HandbookMetaBar";
import { HandbookBreadcrumbs } from "./HandbookBreadcrumbs";
import { PageHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import type { LoadedLearningDoc } from "@/handbook/lib/load-learning-content";
import { extractTocFromMarkdown } from "@/handbook/lib/toc";
import { HandbookToc } from "./HandbookToc";

export function HandbookLearningArticle({
  doc,
  breadcrumbs,
  hubRoute,
  onVisited,
  footer,
}: {
  doc: LoadedLearningDoc;
  breadcrumbs: { label: string; to?: string }[];
  hubRoute?: string;
  onVisited?: () => void;
  footer?: React.ReactNode;
}) {
  const toc = extractTocFromMarkdown(doc.body);

  useEffect(() => {
    onVisited?.();
  }, [onVisited]);

  return (
    <div className="lg:flex lg:gap-10">
      <article className="min-w-0 flex-1">
        <HandbookBreadcrumbs items={breadcrumbs} />
        <PageHeader title={doc.title} description={doc.description} />
        <HandbookMetaBar />
        {hubRoute ? (
          <div className="mb-6">
            <Button variant="outline" size="sm" asChild>
              <Link to={hubRoute}>Open in Support Hub</Link>
            </Button>
          </div>
        ) : null}
        <HandbookProse markdown={doc.body} />
        {footer}
      </article>
      {toc.length > 0 ? (
        <aside className="hidden shrink-0 lg:block lg:w-52">
          <HandbookToc entries={toc} />
        </aside>
      ) : null}
    </div>
  );
}
