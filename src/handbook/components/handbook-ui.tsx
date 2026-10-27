import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { SectionHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const HANDBOOK_SECTION_SCROLL = "scroll-mt-28";

export type HandbookTocItem = { id: string; label: string };

type SectionNavContextValue = {
  activeId: string | null;
  navigateTo: (id: string) => void;
};

const SectionNavContext = createContext<SectionNavContextValue | null>(null);

/** Outline sits outside the section box so it never overlaps text */
export const HANDBOOK_SECTION_HIGHLIGHT_CLASS =
  "my-1 rounded-lg outline outline-2 outline-primary/30 outline-offset-[10px] sm:my-2 sm:outline-offset-[14px]";

export function useHandbookSectionHighlight(sectionId: string) {
  const nav = useContext(SectionNavContext);
  return Boolean(nav?.activeId === sectionId);
}

export function HandbookRoleOverview({ children, className }: { children: ReactNode; className?: string }) {
  const highlighted = useHandbookSectionHighlight("overview");
  return (
    <header
      id="overview"
      className={cn(HANDBOOK_SECTION_SCROLL, "space-y-4", highlighted && HANDBOOK_SECTION_HIGHLIGHT_CLASS, className)}
    >
      {children}
    </header>
  );
}

export function HandbookSectionNavProvider({ items, children }: { items: HandbookTocItem[]; children: ReactNode }) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const scrollLockRef = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const hash = window.location.hash.slice(1);
    return ids.includes(hash) ? hash : null;
  });

  const navigateTo = useCallback((id: string) => {
    if (!ids.includes(id)) return;
    scrollLockRef.current = true;
    setActiveId(id);
    const el = document.getElementById(id);
    if (el) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center", inline: "nearest" });
    }
    window.history.replaceState(null, "", `#${id}`);
    window.setTimeout(() => {
      scrollLockRef.current = false;
    }, 1200);
  }, [ids]);

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1);
      if (ids.includes(hash)) {
        scrollLockRef.current = true;
        setActiveId(hash);
        window.setTimeout(() => {
          scrollLockRef.current = false;
        }, 1200);
      }
    };
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, [ids]);

  useEffect(() => {
    const resolveActiveFromViewport = () => {
      if (scrollLockRef.current) return;
      const centerY = window.innerHeight / 2;
      let containing: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= centerY && rect.bottom > centerY) {
          containing = id;
          break;
        }
      }
      if (containing) {
        setActiveId(containing);
        return;
      }
      let bestId: string | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const sectionCenter = rect.top + rect.height / 2;
        const distance = Math.abs(sectionCenter - centerY);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestId = id;
        }
      }
      if (bestId) setActiveId(bestId);
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        resolveActiveFromViewport();
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    resolveActiveFromViewport();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ids]);

  const value = useMemo(() => ({ activeId, navigateTo }), [activeId, navigateTo]);

  return <SectionNavContext.Provider value={value}>{children}</SectionNavContext.Provider>;
}

export function HandbookOnThisPage({ items }: { items: HandbookTocItem[] }) {
  const ctx = useContext(SectionNavContext);
  if (items.length === 0) return null;

  const navigateTo =
    ctx?.navigateTo ??
    ((id: string) => {
      window.location.hash = id;
    });
  const activeId = ctx?.activeId ?? null;

  return (
    <nav aria-label="On this page" className="rounded-lg border border-border/50 bg-muted/15 px-3 py-3 sm:px-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">On this page</p>
      <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const active = activeId === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo(item.id);
                }}
                aria-current={active ? "location" : undefined}
                className={cn(
                  "flex min-h-[2rem] items-center justify-center rounded-full border px-2.5 py-1 text-center text-xs font-medium leading-tight motion-safe:transition-colors sm:text-[13px]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 bg-card text-foreground hover:border-primary/35 hover:bg-muted/40",
                )}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function HandbookSectionActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>;
}

export function HandbookProse({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-sm leading-relaxed text-muted-foreground sm:text-[15px]", className)}>{children}</p>
  );
}

export function HandbookBulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** Single-line important note: "Important — …" */
export function HandbookInlineCallout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="mt-4 text-sm leading-relaxed">
      <span className="font-semibold text-foreground">{label} — </span>
      <span className="text-muted-foreground">{children}</span>
    </p>
  );
}

/** @deprecated Use HandbookInlineCallout */
export function HandbookCallout({ title, children }: { title: string; children: ReactNode }) {
  return <HandbookInlineCallout label={title}>{children}</HandbookInlineCallout>;
}

export function HandbookWorkflowGuideButton({ slug, label = "Workflow guide" }: { slug: string; label?: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to={`/handbook/workflows/${slug}`}>{label}</Link>
    </Button>
  );
}

export function HandbookAttentionGrid({ children }: { children: ReactNode }) {
  return <ul className="grid gap-2.5 sm:grid-cols-2">{children}</ul>;
}

export function HandbookAttentionItem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="rounded-lg border border-border/50 bg-card/80 px-3.5 py-2.5">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </li>
  );
}

export function HandbookModuleRow({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/80 px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {action}
      </div>
      <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

/** Standard width for handbook learning pages */
export const HANDBOOK_PAGE_CLASS = "mx-auto w-full max-w-6xl space-y-8 pb-6";

export function HandbookRoleEyebrow({ roleLabel }: { roleLabel: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">My role · {roleLabel}</p>
  );
}

export function HandbookSectionBlock({
  id,
  title,
  intro,
  action,
  children,
  className,
  first,
}: {
  id?: string;
  title: string;
  intro?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  first?: boolean;
}) {
  const nav = useContext(SectionNavContext);
  const highlighted = Boolean(id && nav?.activeId === id);

  return (
    <section
      id={id}
      className={cn(
        HANDBOOK_SECTION_SCROLL,
        !first && "border-t border-border/50 pt-8",
        highlighted && HANDBOOK_SECTION_HIGHLIGHT_CLASS,
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <SectionHeader title={title} description={intro} className="mb-0 min-w-0 flex-1" />
        {action ? <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function HandbookCapabilityCard({
  title,
  body,
  icon: Icon,
}: {
  title: string;
  body: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex h-full min-h-[5.5rem] gap-3 rounded-lg border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-snug text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

export function HandbookCapabilityGrid({ children }: { children: ReactNode }) {
  return <ul className="grid gap-3 sm:grid-cols-2">{children}</ul>;
}

function ResponsibilityRow({ work, role }: { work: string; role: string }) {
  return (
    <li className="flex items-baseline justify-between gap-2 px-3 py-1.5 sm:gap-3 sm:px-4 sm:py-2">
      <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">{work}</span>
      <span className="shrink-0 text-right text-sm font-medium text-primary">{role}</span>
    </li>
  );
}

function ResponsibilityColumn({ rows }: { rows: { work: string; role: string }[] }) {
  return (
    <ul className="divide-y divide-border/40">
      {rows.map((row) => (
        <ResponsibilityRow key={row.work} work={row.work} role={row.role} />
      ))}
    </ul>
  );
}

/** Compact responsibility ↔ owner matrix; two balanced columns on desktop, one column on small screens. */
export function HandbookResponsibilityMatrix({ rows }: { rows: { work: string; role: string }[] }) {
  const splitAt = Math.ceil(rows.length / 2);
  const leftColumn = rows.slice(0, splitAt);
  const rightColumn = rows.slice(splitAt);

  return (
    <div className="overflow-hidden rounded-lg border border-border/50 bg-muted/15">
      <div className="md:hidden">
        <ResponsibilityColumn rows={rows} />
      </div>
      <div className="hidden md:grid md:grid-cols-2 md:divide-x md:divide-border/40">
        <ResponsibilityColumn rows={leftColumn} />
        <ResponsibilityColumn rows={rightColumn} />
      </div>
    </div>
  );
}
