import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarRange,
  ChevronDown,
  ClipboardCheck,
  Eye,
  Files,
  Flag,
  Gauge,
  KeyRound,
  LayoutDashboard,
  Library,
  ListChecks,
  LogOut,
  Megaphone,
  Menu,
  MessageSquarePlus,
  Plug,
  RefreshCw,
  ScrollText,
  Sparkles,
  Siren,
  TableProperties,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { FreshdeskStatusPill } from "@/components/design/freshdesk-status";
import { ThemeSwitcher } from "@/components/design/theme-switcher";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { prefetchRoute } from "@/lib/route-prefetch";
import { STALE } from "@/lib/query-client";
import { cn } from "@/lib/utils";

type LinkItem = { to: string; label: string; icon: typeof LayoutDashboard; any: string[] };

type NavGroup = { id: string; label: string; links: LinkItem[] };

const groups: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    links: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, any: [] },
      { to: "/support-updates", label: "Support Updates", icon: Megaphone, any: ["support_updates.view"] },
      { to: "/reported-issues", label: "Reported Issues", icon: Flag, any: ["reported_issues.view_all", "reported_issues.view_own"] },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    links: [
      { to: "/support-actions", label: "Support Actions", icon: MessageSquarePlus, any: ["support_actions.view"] },
      { to: "/escalations", label: "Escalations", icon: Siren, any: ["escalations.view_team", "escalations.view_own"] },
      { to: "/tasks", label: "Tasks", icon: ListChecks, any: ["tasks.view_team", "tasks.view_own"] },
    ],
  },
  {
    id: "knowledge",
    label: "Knowledge & product",
    links: [
      { to: "/knowledge-base", label: "Knowledge Base", icon: Library, any: ["knowledge_base.view"] },
      { to: "/product-guides", label: "Product Guides", icon: BookOpen, any: ["guides.view"] },
      {
        to: "/integration-steps/dashboard",
        label: "Integration Steps",
        icon: Plug,
        any: ["integration.dashboard", "integration.tracker", "integration.library", "integration.tech", "integration.view"],
      },
      { to: "/feature-impacts", label: "Feature Impact", icon: Sparkles, any: ["feature_impact.view", "guides.manage"] },
      { to: "/supported-files/dashboard", label: "Supported Files", icon: Files, any: ["supported_files.dashboard"] },
      { to: "/supported-files/tracker", label: "Supported Files · Tracker", icon: TableProperties, any: ["supported_files.tracker"] },
      { to: "/token-migration/dashboard", label: "Token Migration", icon: LayoutDashboard, any: ["token_migration.dashboard"] },
      { to: "/token-migration/tracker", label: "Token Migration · Tracker", icon: TableProperties, any: ["token_migration.tracker"] },
      { to: "/knowledge?type=integration", label: "Legacy integrations", icon: RefreshCw, any: ["guides.view"] },
    ],
  },
  {
    id: "quality",
    label: "Quality & performance",
    links: [
      { to: "/kpi", label: "KPI", icon: Gauge, any: ["kpi.view_team", "kpi.view_own"] },
      { to: "/qa", label: "QA", icon: ClipboardCheck, any: ["qa.view_team", "qa.view_own", "qa.create"] },
      { to: "/negative-reviews/dashboard", label: "Negative Reviews", icon: LayoutDashboard, any: ["negative_reviews.dashboard"] },
      { to: "/negative-reviews/tracker", label: "Negative Reviews · Tracker", icon: TableProperties, any: ["negative_reviews.tracker"] },
      { to: "/product-feedback/form", label: "Product Feedback", icon: MessageSquarePlus, any: ["feedback.submit"] },
      { to: "/product-feedback/tracker", label: "Product Feedback · Tracker", icon: TableProperties, any: ["feedback.view"] },
    ],
  },
  {
    id: "management",
    label: "Management",
    links: [
      { to: "/weekly", label: "Weekly", icon: CalendarRange, any: ["weekly.view"] },
      { to: "/admin/people", label: "Users", icon: Users, any: ["users.manage", "users.view"] },
      { to: "/admin/freshdesk", label: "Freshdesk", icon: RefreshCw, any: ["freshdesk.manage", "freshdesk.view"] },
      { to: "/admin/audit", label: "Audit", icon: ScrollText, any: ["audit.view"] },
    ],
  },
];

const COLLAPSE_KEY = "koinx-nav-collapsed";

function readCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { can, effective } = useAuth();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => readCollapsed());

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
  }, [collapsed]);

  return (
    <nav className="flex flex-col gap-1">
      {groups.map((group) => {
        const links = group.links.filter((link) => link.any.length === 0 || can(...link.any));
        if (!links.length) return null;
        const isCollapsed = collapsed[group.id] ?? false;
        return (
          <div key={group.id} className="pb-2">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [group.id]: !isCollapsed }))}
              className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase hover:bg-sidebar-accent/60 hover:text-foreground"
            >
              {group.label}
              <ChevronDown className={cn("size-3.5 motion-safe:transition-transform", isCollapsed && "-rotate-90")} />
            </button>
            {!isCollapsed ? (
              <div className="mt-0.5 flex flex-col gap-0.5">
                {links.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === "/"}
                    onClick={onNavigate}
                    onMouseEnter={() => prefetchRoute(queryClient, link.to, { userId: effective?.id })}
                    onFocus={() => prefetchRoute(queryClient, link.to, { userId: effective?.id })}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] motion-safe:transition-[background-color,color] motion-safe:duration-200",
                        isActive
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                          : "text-sidebar-foreground/90 hover:bg-sidebar-accent/50 hover:text-foreground",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <link.icon
                          className={cn("size-4 shrink-0 motion-safe:transition-opacity", isActive ? "text-primary opacity-100" : "opacity-65 group-hover:opacity-100")}
                        />
                        <span className="truncate">{link.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

function AccountMenu() {
  const { user, can, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex max-w-[220px] items-center gap-2.5 rounded-xl border border-border/60 bg-card px-2 py-1.5 text-left shadow-[var(--shadow-card)] motion-safe:transition-[border-color,box-shadow] motion-safe:duration-200 hover:border-primary/20 hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
            {user.name.slice(0, 1)}
          </span>
          <span className="min-w-0 hidden sm:block">
            <span className="block truncate text-sm font-medium text-foreground">{user.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.roleName}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block text-sm text-foreground">{user.name}</span>
          <span className="block text-xs font-normal text-muted-foreground">{user.roleName}</span>
          <span className="block text-xs font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/account")}>
          <UserRound />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/account/password")}>
          <KeyRound />
          Change password
        </DropdownMenuItem>
        {can("users.manage", "users.view") ? (
          <DropdownMenuItem onClick={() => navigate("/admin/people")}>
            <Users />
            User management
          </DropdownMenuItem>
        ) : null}
        {can("view_as") ? (
          <DropdownMenuItem onClick={() => navigate("/view-as")}>
            <Eye />
            View as
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { effective, viewAs, exitViewAs, can } = useAuth();
  const [open, setOpen] = useState(false);
  const sync = useQuery({
    queryKey: ["freshdesk-syncs", viewAs?.id || "self"],
    queryFn: () => api<{ latest: { status: string; finishedAt?: string; message?: string } | null; configured: boolean }>("/api/freshdesk/syncs"),
    enabled: can("freshdesk.view", "freshdesk.manage", "dashboard.overview"),
    staleTime: STALE.session,
  });

  const latest = sync.data?.latest;
  const showFreshdesk = can("freshdesk.view", "freshdesk.manage", "dashboard.overview");
  const syncLabel = !latest
    ? "No Freshdesk sync yet"
    : latest.status === "success"
      ? `Synced ${formatWhen(latest.finishedAt)}`
      : latest.status === "failed"
        ? `Sync failed ${formatWhen(latest.finishedAt)}`
        : latest.status === "running"
          ? "Sync in progress"
          : "Freshdesk not connected · sample metrics";

  const syncStatus: "success" | "failed" | "running" | "idle" | "sample" =
    !latest || !sync.data?.configured
      ? "sample"
      : latest.status === "success"
        ? "success"
        : latest.status === "failed"
          ? "failed"
          : latest.status === "running"
            ? "running"
            : "idle";

  return (
    <div className="min-h-svh bg-background lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
        <div className="border-b border-sidebar-border/80 bg-gradient-to-b from-primary/[0.04] to-transparent px-4 py-5">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-primary">KoinX</p>
          <p className="text-[15px] font-semibold tracking-tight text-foreground">Support Operations</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <NavItems />
        </div>
        <div className="border-t border-sidebar-border p-3">
          <ThemeSwitcher />
        </div>
      </aside>
      <div className="app-atmosphere flex min-w-0 flex-col">
        {viewAs ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 bg-primary px-4 py-2 text-primary-foreground md:px-8">
            <p className="text-xs font-semibold tracking-wide sm:text-sm">
              Viewing as {viewAs.name} · {viewAs.roleName} · read only
            </p>
            <Button variant="secondary" size="sm" onClick={() => void exitViewAs()}>
              Exit view
            </Button>
          </div>
        ) : null}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-card/85 px-4 py-2.5 backdrop-blur-md md:px-8">
          <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <div className="min-w-0 flex-1">
            {showFreshdesk ? (
              <FreshdeskStatusPill label={syncLabel} status={syncStatus} />
            ) : (
              <p className="truncate text-xs text-muted-foreground">{effective?.title || "Support Operations"}</p>
            )}
          </div>
          <AccountMenu />
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[280px] bg-sidebar p-0">
          <div className="border-b border-sidebar-border px-4 py-4">
            <SheetTitle className="text-left text-sm font-semibold">KoinX Support Operations</SheetTitle>
          </div>
          <div className="flex max-h-[min(70vh,520px)] flex-col overflow-y-auto px-2 py-3">
            <NavItems onNavigate={() => setOpen(false)} />
          </div>
          <div className="border-t border-sidebar-border p-3">
            <ThemeSwitcher />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
