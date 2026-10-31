import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import { BookMarked, Compass, Route, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHandbookAudience } from "@/handbook/hooks/useHandbookAudience";
import { roleHandbookByKey } from "@/handbook/lib/learning-catalog";
import { parseWorkflowGuideView } from "@/handbook/lib/role-workflows";
import { HandbookRolePreviewSelect } from "@/handbook/components/HandbookRolePreviewSelect";

function topTabClass(isActive: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium whitespace-nowrap motion-safe:transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    isActive
      ? "bg-primary text-primary-foreground shadow-sm"
      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
  );
}

function workflowSubClass(isActive: boolean) {
  return cn(
    "rounded-md px-2.5 py-1 text-xs font-medium motion-safe:transition-colors",
    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
  );
}

export function HandbookTopNav() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { audienceRole, viewerRole, previewRole, canPreview, setPreviewRole } = useHandbookAudience();
  const roleSlug = audienceRole ? roleHandbookByKey(audienceRole)?.slug : null;
  const rolePath = roleSlug ? `/handbook/role/${roleSlug}` : "/handbook/role";
  const workflowsActive = location.pathname.startsWith("/handbook/workflows");
  const workflowView = parseWorkflowGuideView(searchParams.get("view"));

  const tabs = [
    { to: "/handbook", end: true, label: "Home", icon: Sparkles, match: null as string | null },
    { to: "/handbook/discover", end: false, label: "Discover the Hub", icon: Compass, match: "/handbook/discover" },
    { to: rolePath, end: false, label: "My Role", icon: BookMarked, match: "/handbook/role" },
    {
      to: "/handbook/workflows?view=my",
      end: false,
      label: "Workflow Guides",
      icon: Route,
      match: "/handbook/workflows",
    },
    { to: "/handbook/search", end: false, label: "Search", icon: Search, match: "/handbook/search" },
  ] as const;

  function tabIsActive(tab: (typeof tabs)[number], navLinkActive: boolean) {
    if (tab.match) return location.pathname.startsWith(tab.match);
    return navLinkActive;
  }

  return (
    <header className="mb-6 border-b border-border/60 pb-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav
          className="-mx-1 flex flex-wrap items-center gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Hub Handbook sections"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.label}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) => topTabClass(tabIsActive(tab, isActive))}
              >
                <Icon className="size-3.5 shrink-0 opacity-90" aria-hidden />
                {tab.label}
              </NavLink>
            );
          })}
        </nav>
        {canPreview && viewerRole ? (
          <HandbookRolePreviewSelect
            viewerRole={viewerRole}
            previewRole={previewRole}
            onSelect={setPreviewRole}
            className="shrink-0 self-start lg:self-center"
          />
        ) : null}
      </div>
      {workflowsActive ? (
        <div
          className="mt-3 flex flex-wrap items-center gap-1 border-t border-border/40 pt-3"
          role="group"
          aria-label="Workflow directory view"
        >
          <NavLink to="/handbook/workflows?view=my" className={() => workflowSubClass(workflowView === "my")}>
            My workflows
          </NavLink>
          <NavLink to="/handbook/workflows?view=all" className={() => workflowSubClass(workflowView === "all")}>
            All workflows
          </NavLink>
        </div>
      ) : null}
    </header>
  );
}
