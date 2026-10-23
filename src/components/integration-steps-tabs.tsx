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
import { PageHeader } from "@/components/bits";
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

const STORAGE_KEY_PREFIX = "koinx-is-open-tabs-v1";
const VISIBLE_TAB_LIMIT = 5;

function tabsStorageKey(userId: string | undefined) {
  if (!userId) return null;
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

export type IntegrationStepsTab = { id: string; title: string };

type PendingNav = { to: string; onConfirm: () => void };

type TabsContextValue = {
  tabs: IntegrationStepsTab[];
  openIntegration: (id: string, title: string, opts?: { search?: string; edit?: boolean }) => void;
  navigateIntegrations: (to: string) => void;
  setIntegrationTitle: (id: string, title: string) => void;
  closeIntegrationTab: (id: string) => void;
  registerDirty: (key: string, dirty: boolean) => void;
  isDirty: (key: string) => boolean;
  pendingNav: PendingNav | null;
  confirmPendingNav: () => void;
  cancelPendingNav: () => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function loadStoredTabs(storageKey: string | null): IntegrationStepsTab[] {
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

export function integrationIdFromPath(pathname: string) {
  const detail = pathname.match(/^\/integration-steps\/([a-f\d]{24})$/i);
  if (detail) return detail[1];
  const edit = pathname.match(/^\/integration-steps\/([a-f\d]{24})\/edit$/i);
  if (edit) return edit[1];
  return null;
}

export function IntegrationStepsTabsProvider({ children }: { children: ReactNode }) {
  const { effective } = useAuth();
  const userId = effective?.id;
  const storageKeyRef = useRef<string | null>(tabsStorageKey(userId));
  const [tabs, setTabs] = useState<IntegrationStepsTab[]>([]);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(() => new Set());
  const [pendingNav, setPendingNav] = useState<PendingNav | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const recentRef = useRef<string[]>([]);

  const saveTabs = useCallback((next: IntegrationStepsTab[]) => {
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

  const setIntegrationTitle = useCallback((id: string, title: string) => {
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
      const existing = prev.find((t) => t.id === id);
      if (existing) {
        if (existing.title === title || title === "Integration") return prev;
        const next = prev.map((t) => (t.id === id ? { ...t, title } : t));
        saveTabs(next);
        return next;
      }
      const next = [...prev, { id, title }];
      saveTabs(next);
      return next;
    });
  }, [saveTabs]);

  const guardedNavigate = useCallback(
    (to: string, onConfirm?: () => void) => {
      const fromId = integrationIdFromPath(location.pathname);
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

  const openIntegration = useCallback(
    (id: string, title: string, opts?: { search?: string; edit?: boolean }) => {
      let search = opts?.search ?? "";
      if (opts?.edit) {
        search = search.includes("pending=1") ? "?pendingEdit=1" : "?draftEdit=1";
      }
      ensureTab(id, title);
      recentRef.current = [id, ...recentRef.current.filter((x) => x !== id)].slice(0, 20);
      void queryClient.invalidateQueries({ queryKey: ["is-detail", id] });
      guardedNavigate(`/integration-steps/${id}${search}`);
    },
    [ensureTab, guardedNavigate, queryClient],
  );

  const closeIntegrationTab = useCallback(
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
            const activeId = integrationIdFromPath(location.pathname);
            if (activeId === id) {
              const fallback = recentRef.current.find((x) => x !== id && tabs.some((t) => t.id === x));
              if (fallback) guardedNavigate(`/integration-steps/${fallback}`);
              else guardedNavigate("/integration-steps/dashboard");
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
      const activeId = integrationIdFromPath(location.pathname);
      if (activeId === id) {
        const fallback = recentRef.current.find((x) => x !== id && tabs.some((t) => t.id === x));
        if (fallback) navigate(`/integration-steps/${fallback}`);
        else navigate("/integration-steps/dashboard");
      }
    },
    [dirtyKeys, location.pathname, navigate, registerDirty, tabs, guardedNavigate, saveTabs],
  );

  useEffect(() => {
    const id = integrationIdFromPath(location.pathname);
    if (id) {
      ensureTab(id, "Integration");
      recentRef.current = [id, ...recentRef.current.filter((x) => x !== id)].slice(0, 20);
    }
  }, [location.pathname, ensureTab]);

  const value = useMemo(
    () => ({
      tabs,
      openIntegration,
      navigateIntegrations: (to: string) => guardedNavigate(to),
      setIntegrationTitle,
      closeIntegrationTab,
      registerDirty,
      isDirty,
      pendingNav,
      confirmPendingNav: () => {
        pendingNav?.onConfirm();
        setPendingNav(null);
      },
      cancelPendingNav: () => setPendingNav(null),
    }),
    [tabs, openIntegration, guardedNavigate, setIntegrationTitle, closeIntegrationTab, registerDirty, isDirty, pendingNav],
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

export function useIntegrationStepsTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("useIntegrationStepsTabs must be used within IntegrationStepsTabsProvider");
  return ctx;
}

function truncateTitle(title: string, max = 28) {
  const t = title.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const SECTION_LINKS = [
  { to: "/integration-steps/dashboard", label: "Dashboard", any: ["integration.dashboard"] as const },
  { to: "/integration-steps/tracker", label: "Tracker", any: ["integration.tracker"] as const },
  { to: "/integration-steps/tasks", label: "My tasks", any: ["integration.dashboard"] as const },
];

export function IntegrationStepsLayout() {
  const { tabs, closeIntegrationTab, openIntegration, navigateIntegrations } = useIntegrationStepsTabs();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const location = useLocation();
  const activeIntegrationId = integrationIdFromPath(location.pathname);

  useEffect(() => {
    if (!location.pathname.startsWith("/integration-steps")) return;
    void queryClient.refetchQueries({ queryKey: ["is-my-tasks"] });
    void queryClient.refetchQueries({ queryKey: ["is-tracker"] });
    void queryClient.refetchQueries({ queryKey: ["is-stats"] });
  }, [location.pathname, queryClient]);

  const links = SECTION_LINKS.filter((l) => {
    if (l.to.endsWith("/tracker")) return can("integration.tracker") || can("integration.library");
    return can(...l.any);
  });
  const visible = tabs.slice(0, VISIBLE_TAB_LIMIT);
  const overflow = tabs.slice(VISIBLE_TAB_LIMIT);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Operations" title="Integration Steps" />
      <div className="flex flex-col gap-2 border-b border-border pb-2">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {links.map((link) => {
            const active = location.pathname === link.to || (link.to.endsWith("/dashboard") && location.pathname === "/integration-steps");
            return (
              <button
                key={link.to}
                type="button"
                onClick={() => navigateIntegrations(link.to)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${
                  active ? "bg-blue-50 font-medium text-blue-800" : "text-muted-foreground hover:bg-muted/40"
                }`}
              >
                {link.label}
              </button>
            );
          })}
          {visible.map((tab) => {
            const active = activeIntegrationId === tab.id;
            return (
              <div
                key={tab.id}
                className={`flex max-w-[11rem] shrink-0 items-center gap-0.5 rounded-lg border px-1 py-0.5 text-sm ${
                  active ? "border-primary/40 bg-primary/5 font-medium" : "border-border/60 hover:bg-muted/40"
                }`}
              >
                <button
                  type="button"
                  title={tab.title}
                  className="min-w-0 truncate px-2 py-0.5 text-left"
                  onClick={() => openIntegration(tab.id, tab.title)}
                >
                  {truncateTitle(tab.title)}
                </button>
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Close ${tab.title}`}
                  onClick={() => closeIntegrationTab(tab.id)}
                >
                  ×
                </button>
              </div>
            );
          })}
          {overflow.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-8 shrink-0">
                  +{overflow.length} more
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-w-xs">
                {overflow.map((tab) => (
                  <DropdownMenuItem
                    key={tab.id}
                    className="flex items-center justify-between gap-2"
                    onSelect={() => openIntegration(tab.id, tab.title)}
                  >
                    <span className="truncate" title={tab.title}>{tab.title}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeIntegrationTab(tab.id);
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

export function IntegrationTabLink({
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
  const { openIntegration } = useIntegrationStepsTabs();
  return (
    <button type="button" className={className} onClick={() => openIntegration(id, title)}>
      {children}
    </button>
  );
}
