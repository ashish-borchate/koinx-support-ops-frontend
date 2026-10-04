import { QueryClient } from "@tanstack/react-query";

/** Default stale times (ms) by data class — tune per-query when needed. */
export const STALE = {
  /** Dashboard, attention aggregates */
  workspace: 45_000,
  /** Trackers that change frequently */
  operational: 25_000,
  /** KB, guides, supported files library */
  reference: 120_000,
  /** Exchange name lists, meta */
  catalog: 300_000,
  /** Auth/session adjacent */
  session: 60_000,
} as const;

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        staleTime: STALE.operational,
        gcTime: 10 * 60_000,
      },
    },
  });
}
