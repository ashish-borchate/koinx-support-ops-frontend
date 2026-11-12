import { useCallback, useEffect, useRef, useState } from "react";
import { type Query, useQueryClient } from "@tanstack/react-query";

/** Live Sync tab auto-refresh interval (read-only MongoDB-backed GETs only). */
export const SUPPORT_ANALYTICS_LIVE_POLL_MS = 30_000;

const LIVE_POLL_SEGMENTS = new Set(["overview", "sync-status", "live-groups"]);

/** Queries refreshed on the Live Sync tab — excludes manual sync and historical endpoints. */
export function isSupportAnalyticsLivePollQuery(query: Query): boolean {
  const key = query.queryKey;
  if (!Array.isArray(key) || key[0] !== "support-analytics") return false;
  const segment = key[1];
  if (segment === "live-agents" && key[2] === "list") return true;
  return typeof segment === "string" && LIVE_POLL_SEGMENTS.has(segment);
}

/**
 * Polls Live Sync dashboard data every 30s while `active` and the browser tab is visible.
 * Refetches once when the tab becomes visible again. Uses a single interval (no per-query timers).
 */
export function useSupportAnalyticsLivePolling(active: boolean) {
  const qc = useQueryClient();
  const [tabVisible, setTabVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );
  const wasHiddenRef = useRef(
    typeof document !== "undefined" && document.visibilityState === "hidden",
  );
  const pollInFlightRef = useRef(false);

  const pollLiveQueries = useCallback(async () => {
    if (pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    try {
      await qc.refetchQueries({
        type: "active",
        predicate: isSupportAnalyticsLivePollQuery,
      });
    } finally {
      pollInFlightRef.current = false;
    }
  }, [qc]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const onVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible";
      if (isVisible && wasHiddenRef.current && active) {
        void pollLiveQueries();
      }
      wasHiddenRef.current = !isVisible;
      setTabVisible(isVisible);
    };

    wasHiddenRef.current = document.visibilityState === "hidden";
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [active, pollLiveQueries]);

  useEffect(() => {
    if (!active || !tabVisible) return;

    const id = window.setInterval(() => {
      void pollLiveQueries();
    }, SUPPORT_ANALYTICS_LIVE_POLL_MS);

    return () => window.clearInterval(id);
  }, [active, tabVisible, pollLiveQueries]);

  return { polling: active && tabVisible, refreshLiveQueries: pollLiveQueries };
}
