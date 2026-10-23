import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  Eye,
  Files,
  Flag,
  Gauge,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LineChart,
  Library,
  LogOut,
  Megaphone,
  Menu,
  MessageSquarePlus,
  Plug,
  Sparkles,
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
import { HubNotificationToasts } from "@/components/hub-notification-toasts";
import { ThemeSwitcher } from "@/components/design/theme-switcher";
import { useAuth } from "@/lib/auth";
import { moduleHomePath } from "@/lib/module-nav";
import { prefetchRoute } from "@/lib/route-prefetch";
import { cn } from "@/lib/utils";

type LinkItem = { to: string; label: string; icon: typeof LayoutDashboard; any: string[] };

type NavGroup = { id: string; label: string; links: LinkItem[] };

function resolveNavTo(to: string, can: (...keys: string[]) => boolean) {
  if (to === "/supported-files/dashboard") {
    return moduleHomePath(can, "/supported-files", "supported_files.dashboard", "supported_files.tracker");
  }
  if (to === "/token-migration/dashboard") {
    return moduleHomePath(can, "/token-migration", "token_migration.dashboard", "token_migration.tracker");
  }
  if (to === "/negative-reviews/dashboard") {
    return moduleHomePath(can, "/negative-reviews", "negative_reviews.dashboard", "negative_reviews.tracker");
  }
  return to;
}

const groups: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    links: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, any: [] },
      { to: "/management", label: "Management Overview", icon: LineChart, any: ["management.view"] },
      { to: "/support-updates", label: "Support Updates", icon: Megaphone, any: ["support_updates.view"] },
      { to: "/reported-issues", label: "Reported Issues", icon: Flag, any: ["reported_issues.view_all", "reported_issues.view_own"] },
    ],
  },
  {
    id: "quality",
    label: "Quality & performance",
    links: [
      { to: "/kpi", label: "KPI Performance", icon: Gauge, any: ["kpi.view_team", "kpi.view_own"] },
      { to: "/qa", label: "Quality Assurance", icon: ClipboardCheck, any: ["qa.view_team", "qa.view_own", "qa.create"] },
      { to: "/negative-reviews/dashboard", label: "Negative Reviews", icon: LayoutDashboard, any: ["negative_reviews.dashboard", "negative_reviews.tracker"] },
      { to: "/coaching", label: "Coaching Center", icon: GraduationCap, any: ["coaching.view_team", "coaching.view_own"] },
    ],
  },
  {
    id: "knowledge",
    label: "Knowledge & product",
    links: [
      { to: "/product-guides", label: "Product Guides", icon: BookOpen, any: ["guides.view"] },
      {
        to: "/integration-steps/dashboard",
        label: "Integration Steps",
        icon: Plug,
        any: ["integration.dashboard", "integration.tracker", "integration.library", "integration.tech", "integration.view"],
      },
      { to: "/supported-files/dashboard", label: "Supported Files", icon: Files, any: ["supported_files.dashboard", "supported_files.tracker"] },
      { to: "/token-migration/dashboard", label: "Token Migration", icon: LayoutDashboard, any: ["token_migration.dashboard", "token_migration.tracker"] },
      { to: "/product-feedback", label: "Product Feedback", icon: MessageSquarePlus, any: ["feedback.submit", "feedback.view"] },
      { to: "/feature-impacts", label: "Feature Impact", icon: Sparkles, any: ["feature_impact.view", "guides.manage"] },
      { to: "/knowledge-base", label: "Knowledge Base", icon: Library, any: ["knowledge_base.view"] },
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
        const links = group.links
          .filter((link) => link.any.length === 0 || can(...link.any))
          .map((link) => ({ ...link, to: resolveNavTo(link.to, can) }));
        if (!links.length) return null;
        const isCollapsed = collapsed[group.id] ?? false;
        return (
          <div key={group.id} className="pb-2">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [group.id]: !isCollapsed }))}
              className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-primary uppercase motion-safe:transition-colors motion-safe:duration-200 hover:bg-sidebar-accent/60 hover:text-primary"
            >
              {group.label}
              <ChevronDown
                className={cn(
                  "size-3.5 text-primary/70 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out",
                  isCollapsed && "-rotate-90",
                )}
              />
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
                          ? "bg-sidebar-accent font-medium text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary motion-safe:transition-[background-color]"
                          : "text-sidebar-foreground/90 hover:bg-sidebar-accent/55 hover:text-foreground",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <link.icon
                          className={cn(
                            "size-4 shrink-0 text-foreground motion-safe:transition-opacity",
                            isActive ? "opacity-90" : "opacity-65 group-hover:opacity-100",
                          )}
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

function SidebarFooterCredit() {
  return (
    <p
      className="flex flex-col items-center rounded-lg border border-primary/45 bg-primary/[0.04] px-2 py-2 text-center text-[10px] leading-snug font-medium text-foreground/90 select-none dark:border-primary/55 dark:bg-primary/[0.08] dark:text-foreground/95"
    >
      <span className="whitespace-nowrap">Designed and Built from scratch, Thoughtfully,</span>
      <span className="whitespace-nowrap">for the KoinX Support Team 💙 - Ashish</span>
    </p>
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
          <span className="min-w-0 hidden truncate text-sm font-medium text-foreground sm:block">{user.name}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2.5 font-normal">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
            {user.name.slice(0, 1)}
          </span>
          <span className="min-w-0 truncate text-sm font-medium text-foreground">{user.name}</span>
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
        <div
          className="px-2 py-2"
          onPointerDown={(event) => event.preventDefault()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <ThemeSwitcher className="space-y-1.5" />
        </div>
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
  const { viewAs, exitViewAs } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-svh bg-background lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-svh max-h-svh flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="shrink-0 border-b border-sidebar-border/80 bg-gradient-to-b from-primary/[0.04] to-transparent px-4 py-5">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-primary">KoinX</p>
          <p className="text-[15px] font-semibold tracking-tight text-foreground">Support Operations</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          <NavItems />
        </div>
        <div className="shrink-0 border-t border-sidebar-border px-3 pt-3 pb-4">
          <SidebarFooterCredit />
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
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/70 bg-card/80 px-4 py-2.5 shadow-[0_1px_0_0_rgb(0_0_0/0.03)] backdrop-blur-md supports-[backdrop-filter]:bg-card/75 md:px-8 dark:shadow-none">
          <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">Support Operations</p>
          </div>
          <AccountMenu />
        </header>
        <HubNotificationToasts />
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
            <SidebarFooterCredit />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
