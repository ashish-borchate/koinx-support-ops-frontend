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
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY_PREFIX = "koinx-pg-open-tabs-v1";
const VISIBLE_TAB_LIMIT = 5;

function tabsStorageKey(userId: string | undefined) {
  if (!userId) return null;
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

export type ProductGuideTab = { id: string; title: string };

type PendingNav = { to: string; onConfirm: () => void };

type TabsContextValue = {
  tabs: ProductGuideTab[];
  openGuide: (id: string, title: string, search?: string) => void;
  navigateGuides: (to: string) => void;
  setGuideTitle: (id: string, title: string) => void;
  closeGuideTab: (id: string) => void;
  registerDirty: (key: string, dirty: boolean) => void;
  isDirty: (key: string) => boolean;
  pendingNav: PendingNav | null;
  confirmPendingNav: () => void;
  cancelPendingNav: () => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function loadStoredTabs(storageKey: string | null): ProductGuideTab[] {
  if (!storageKey) return [];
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t) => t && typeof t.id === "string" && typeof t.title === "string")
      .map((t) => ({ id: t.id, title: String(t.title).slice(0, 200) }));
  } catch {
    return [];
  }
}

function guideIdFromPath(pathname: string) {
  const detail = pathname.match(/^\/product-guides\/([a-f\d]{24})$/i);
  if (detail) return detail[1];
  const edit = pathname.match(/^\/product-guides\/([a-f\d]{24})\/edit$/i);
  if (edit) return edit[1];
  return null;
}

export function ProductGuideTabsProvider({ children }: { children: ReactNode }) {
  const { effective } = useAuth();
  const userId = effective?.id;
  const storageKeyRef = useRef<string | null>(tabsStorageKey(userId));
  const [tabs, setTabs] = useState<ProductGuideTab[]>([]);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(() => new Set());
  const [pendingNav, setPendingNav] = useState<PendingNav | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const recentRef = useRef<string[]>([]);

  const saveTabs = useCallback((next: ProductGuideTab[]) => {
    const key = storageKeyRef.current;
    if (!key) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }, []);

  useEffect(() => {
    const key = tabsStorageKey(userId);
    storageKeyRef.current = key;
    setTabs(loadStoredTabs(key));
    setDirtyKeys(new Set());
    setPendingNav(null);
    recentRef.current = [];
  }, [userId]);

  const registerDirty = useCallback((key: string, dirty: boolean) => {
    setDirtyKeys((prev) => {
      const next = new Set(prev);
      if (dirty) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const isDirty = useCallback((key: string) => dirtyKeys.has(key), [dirtyKeys]);

  const setGuideTitle = useCallback((id: string, title: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx < 0 || prev[idx].title === title) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], title };
      saveTabs(next);
      return next;
    });
  }, [saveTabs]);

  const ensureTab = useCallback((id: string, title: string) => {
    setTabs((prev) => {
      if (prev.some((t) => t.id === id)) return prev;
      const next = [...prev, { id, title }];
      saveTabs(next);
      return next;
    });
  }, [saveTabs]);

  const guardedNavigate = useCallback(
    (to: string, onConfirm?: () => void) => {
      const fromId = guideIdFromPath(location.pathname);
      const dirtyKey = fromId && location.pathname.includes("/edit") ? `edit:${fromId}` : null;
      if (dirtyKey && dirtyKeys.has(dirtyKey) && to !== location.pathname) {
        setPendingNav({ to, onConfirm: onConfirm || (() => navigate(to)) });
        return;
      }
      if (onConfirm) onConfirm();
      else navigate(to);
    },
    [dirtyKeys, location.pathname, navigate],
  );

  const openGuide = useCallback(
    (id: string, title: string, search = "") => {
      ensureTab(id, title);
      recentRef.current = [id, ...recentRef.current.filter((x) => x !== id)].slice(0, 20);
      void queryClient.invalidateQueries({ queryKey: ["product-guide", id] });
      guardedNavigate(`/product-guides/${id}${search}`);
    },
    [ensureTab, guardedNavigate, queryClient],
  );

  const closeGuideTab = useCallback(
    (id: string) => {
      const editDirty = dirtyKeys.has(`edit:${id}`);
      if (editDirty) {
        setPendingNav({
          to: "__close__",
          onConfirm: () => {
            registerDirty(`edit:${id}`, false);
            setTabs((prev) => {
              const next = prev.filter((t) => t.id !== id);
              saveTabs(next);
              return next;
            });
            const activeId = guideIdFromPath(location.pathname);
            if (activeId === id) {
              const fallback = recentRef.current.find((x) => x !== id && tabs.some((t) => t.id === x));
              if (fallback) guardedNavigate(`/product-guides/${fallback}`);
              else guardedNavigate("/product-guides");
            }
          },
        });
        return;
      }
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        saveTabs(next);
        return next;
      });
      const activeId = guideIdFromPath(location.pathname);
      if (activeId === id) {
        const fallback = recentRef.current.find((x) => x !== id && tabs.some((t) => t.id === x));
        if (fallback) navigate(`/product-guides/${fallback}`);
        else navigate("/product-guides");
      }
    },
    [dirtyKeys, location.pathname, navigate, registerDirty, tabs, guardedNavigate, saveTabs],
  );

  useEffect(() => {
    const id = guideIdFromPath(location.pathname);
    if (id) {
      ensureTab(id, "Guide");
      recentRef.current = [id, ...recentRef.current.filter((x) => x !== id)].slice(0, 20);
    }
  }, [location.pathname, ensureTab]);

  const value = useMemo(
    () => ({
      tabs,
      openGuide,
      navigateGuides: (to: string) => guardedNavigate(to),
      setGuideTitle,
      closeGuideTab,
      registerDirty,
      isDirty,
      pendingNav,
      confirmPendingNav: () => {
        pendingNav?.onConfirm();
        setPendingNav(null);
      },
      cancelPendingNav: () => setPendingNav(null),
    }),
    [tabs, openGuide, guardedNavigate, setGuideTitle, closeGuideTab, registerDirty, isDirty, pendingNav],
  );

  return (
    <TabsContext.Provider value={value}>
      {children}
      <Dialog open={Boolean(pendingNav)} onOpenChange={(open) => !open && setPendingNav(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              You have unsaved edits. Leaving will discard them. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPendingNav(null)}>
              Stay and continue editing
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                pendingNav?.onConfirm();
                setPendingNav(null);
              }}
            >
              Leave and discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabsContext.Provider>
  );
}

export function useProductGuideTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("useProductGuideTabs must be used within ProductGuideTabsProvider");
  return ctx;
}

const PG_TAB_BASE =
  "shrink-0 rounded-lg border px-3 py-1.5 text-sm motion-safe:transition-colors motion-safe:duration-200";
const PG_TAB_ACTIVE = "border-primary bg-primary/10 font-medium text-primary";
const PG_TAB_INACTIVE = "border-border text-muted-foreground hover:border-primary/45 hover:bg-muted/40 hover:text-foreground";

function pgTabClass(active: boolean) {
  return `${PG_TAB_BASE} ${active ? PG_TAB_ACTIVE : PG_TAB_INACTIVE}`;
}

function truncateTitle(title: string, max = 28) {
  const t = title.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function ProductGuidesLayout() {
  const { tabs, closeGuideTab, openGuide, navigateGuides } = useProductGuideTabs();
  const queryClient = useQueryClient();
  const { effective } = useAuth();
  const location = useLocation();
  const activeGuideId = guideIdFromPath(location.pathname);
  const roleKey = effective?.roleKey;
  const showDailyReview = roleKey === "agent";
  const showAgentFeedback = roleKey === "admin" || roleKey === "supervisor";

  const visible = tabs.slice(0, VISIBLE_TAB_LIMIT);
  const overflow = tabs.slice(VISIBLE_TAB_LIMIT);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 border-b border-border pb-2">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ["product-guides"] });
              void queryClient.invalidateQueries({ queryKey: ["pg-stats"] });
              navigateGuides("/product-guides");
            }}
            className={pgTabClass(location.pathname === "/product-guides")}
          >
            Guides
          </button>
          <button
            type="button"
            onClick={() => navigateGuides("/product-guides/tasks")}
            className={pgTabClass(location.pathname === "/product-guides/tasks")}
          >
            Tasks
          </button>
          {showDailyReview ? (
            <button
              type="button"
              onClick={() => navigateGuides("/product-guides/daily-review")}
              className={pgTabClass(location.pathname.startsWith("/product-guides/daily-review"))}
            >
              Daily Review
            </button>
          ) : null}
          {showAgentFeedback ? (
            <button
              type="button"
              onClick={() => navigateGuides("/product-guides/agent-feedback")}
              className={pgTabClass(location.pathname.startsWith("/product-guides/agent-feedback"))}
            >
              Agent Feedback
            </button>
          ) : null}
          {visible.map((tab) => {
            const active = activeGuideId === tab.id;
            return (
              <div
                key={tab.id}
                className={`flex shrink-0 max-w-[11rem] items-center gap-0.5 rounded-lg border px-1 py-0.5 text-sm ${
                  active ? "border-primary bg-primary/10 font-medium text-primary" : "border-border hover:border-primary/45 hover:bg-muted/40"
                }`}
              >
                <button
                  type="button"
                  title={tab.title}
                  className="min-w-0 truncate px-2 py-0.5 text-left"
                  onClick={() => openGuide(tab.id, tab.title)}
                >
                  {truncateTitle(tab.title)}
                </button>
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Close ${tab.title}`}
                  onClick={() => closeGuideTab(tab.id)}
                >
                  ×
                </button>
              </div>
            );
          })}
          {overflow.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="shrink-0 h-8">
                  +{overflow.length} more
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-w-xs">
                {overflow.map((tab) => (
                  <DropdownMenuItem
                    key={tab.id}
                    className="flex items-center justify-between gap-2"
                    onSelect={() => openGuide(tab.id, tab.title)}
                  >
                    <span className="truncate" title={tab.title}>{tab.title}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeGuideTab(tab.id);
                      }}
                    >
                      ×
                    </button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
      <Outlet />
    </div>
  );
}

export function ProductGuideTabLink({
  id,
  title,
  className,
  children,
}: {
  id: string;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  const { openGuide } = useProductGuideTabs();
  return (
    <button type="button" className={className} onClick={() => openGuide(id, title)}>
      {children}
    </button>
  );
}
