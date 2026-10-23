import type { QueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { STALE } from "./query-client";

type Dash = unknown;

function dashboardQuery(userId: string | undefined) {
  return {
    queryKey: ["dashboard", userId] as const,
    queryFn: () => api<Dash>("/api/dashboard"),
    staleTime: STALE.workspace,
  };
}

const prefetchers: Record<string, (qc: QueryClient, ctx: { userId?: string }) => void> = {
  "/": (qc, ctx) => {
    void qc.prefetchQuery(dashboardQuery(ctx.userId));
  },
  "/reported-issues": (qc) => {
    void qc.prefetchQuery({
      queryKey: ["reported-issues"],
      queryFn: () => api("/api/reported-issues?limit=40"),
      staleTime: STALE.operational,
    });
  },
  "/knowledge-base": (qc) => {
    void qc.prefetchQuery({
      queryKey: ["knowledge-base-meta"],
      queryFn: () => api("/api/knowledge-base/meta"),
      staleTime: STALE.catalog,
    });
  },
  "/product-guides": (qc) => {
    void qc.prefetchQuery({
      queryKey: ["product-guides", "", "all", "all"],
      queryFn: () => api("/api/product-guides"),
      staleTime: STALE.reference,
    });
  },
  "/supported-files/tracker": (qc) => {
    void qc.prefetchQuery({
      queryKey: ["supported-files-list", ""],
      queryFn: () => api("/api/supported-files"),
      staleTime: STALE.reference,
    });
  },
  "/supported-files/dashboard": (qc) => {
    void qc.prefetchQuery({
      queryKey: ["supported-files-dashboard"],
      queryFn: () => api("/api/supported-files/dashboard"),
      staleTime: STALE.reference,
    });
  },
  "/qa": (qc) => {
    void qc.prefetchQuery({
      queryKey: ["qa"],
      queryFn: () => api("/api/qa"),
      staleTime: STALE.operational,
    });
  },
  "/negative-reviews/dashboard": (qc) => {
    void qc.prefetchQuery({
      queryKey: ["nr-dashboard", "", ""],
      queryFn: () => api("/api/negative-reviews/dashboard"),
      staleTime: STALE.reference,
    });
  },
  "/negative-reviews/tracker": (qc) => {
    void qc.prefetchQuery({
      queryKey: ["nr-list", "page=1"],
      queryFn: () => api("/api/negative-reviews?page=1"),
      staleTime: STALE.operational,
    });
  },
};

/** Prefetch a linked record (product guide, integration, KB article) before navigation. */
export function prefetchRecordHref(qc: QueryClient, href: string) {
  const path = href.split("?")[0];
  const productGuide = path.match(/^\/product-guides\/([a-f\d]{24})$/i);
  if (productGuide) {
    const id = productGuide[1];
    void qc.prefetchQuery({
      queryKey: ["product-guide", id],
      queryFn: () => api(`/api/product-guides/${id}`),
      staleTime: STALE.reference,
    });
    return;
  }
  const integration = path.match(/^\/integration-steps\/([a-f\d]{24})$/i);
  if (integration) {
    const id = integration[1];
    void qc.prefetchQuery({
      queryKey: ["is-detail", id],
      queryFn: () => api(`/api/integration-steps/${id}`),
      staleTime: STALE.reference,
    });
    return;
  }
  const kb = path.match(/^\/knowledge-base\/([a-f\d]{24})$/i);
  if (kb) {
    const id = kb[1];
    void qc.prefetchQuery({
      queryKey: ["knowledge-base", id],
      queryFn: () => api(`/api/knowledge-base/${id}`),
      staleTime: STALE.reference,
    });
  }
}

/** Prefetch main module query on nav hover/focus when data is stale. */
export function prefetchRoute(qc: QueryClient, path: string, ctx: { userId?: string }) {
  const base = path.split("?")[0];
  const fn =
    prefetchers[base] ||
    (base.startsWith("/integration-steps") ? prefetchers["/product-guides"] : undefined) ||
    (base.startsWith("/supported-files") ? prefetchers["/supported-files/tracker"] : undefined) ||
    (base.startsWith("/negative-reviews") ? prefetchers["/negative-reviews/tracker"] : undefined);
  if (!fn) return;
  const state = qc.getQueryState(["dashboard", ctx.userId]);
  if (base === "/" && state?.dataUpdatedAt && Date.now() - state.dataUpdatedAt < STALE.workspace) return;
  fn(qc, ctx);
}
