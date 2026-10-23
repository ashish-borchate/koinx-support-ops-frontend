import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function useQaModuleNav() {
  const { can, effective } = useAuth();
  const roleKey = effective?.roleKey ?? "";

  const isSeniorAgent = roleKey === "senior_agent";
  const isSupervisor = roleKey === "supervisor";
  const isAdmin = roleKey === "admin";

  const showRandomAudits =
    (isSupervisor || isAdmin) && can("qa.random_audit.view_team");

  const showSeniorAgentQaTab = isSupervisor || isAdmin;
  const showYourQaTab = isSeniorAgent;

  const showAgentQaTab =
    can("qa.view_team") || can("qa.view_own") || can("qa.create") || isSeniorAgent;

  const showAppealsTab = roleKey !== "tech_agent" && (can("qa.view_own") || can("qa.view_team"));
  const showNav = showAgentQaTab || showSeniorAgentQaTab || showYourQaTab || showRandomAudits || showAppealsTab;

  return {
    showRandomAudits,
    showSeniorAgentQaTab,
    showYourQaTab,
    showAgentQaTab,
    showNav,
    roleKey,
    showAppealsTab,
    isSeniorAgent,
  };
}

export function QaModuleNav() {
  const location = useLocation();
  const [params] = useSearchParams();
  const {
    showRandomAudits,
    showSeniorAgentQaTab,
    showYourQaTab,
    showAgentQaTab,
    showAppealsTab,
    showNav,
    isSeniorAgent,
    roleKey,
  } = useQaModuleNav();
  const mode = params.get("qaMode") === "senior_agent_qa" ? "senior_agent_qa" : "agent_qa";
  const onRandomAudits = location.pathname.startsWith("/qa/random-audits");
  const onAppeals = location.pathname.startsWith("/qa/appeals");
  const onYourQa =
    !onRandomAudits &&
    !onAppeals &&
    location.pathname.startsWith("/qa") &&
    mode === "senior_agent_qa" &&
    isSeniorAgent;
  const onSeniorAgentQa =
    !onRandomAudits && !onAppeals && location.pathname.startsWith("/qa") && mode === "senior_agent_qa" && !isSeniorAgent;
  const onAgentQa = !onRandomAudits && !onAppeals && location.pathname.startsWith("/qa") && mode === "agent_qa";

  const tabClass = (active: boolean) =>
    cn(
      "inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors",
      active
        ? "border-border bg-card text-foreground"
        : "border-border/50 bg-muted/30 text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground",
    );

  if (!showNav) return null;

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-border/60 pb-3" aria-label="QA sections">
      {showAgentQaTab ? (
        <Link to="/qa" className={tabClass(onAgentQa)}>
          {roleKey === "agent" || roleKey === "tech_agent" ? "Your QA" : "Agent QA"}
        </Link>
      ) : null}
      {showYourQaTab ? (
        <Link to="/qa?qaMode=senior_agent_qa" className={tabClass(onYourQa)}>
          Your QA
        </Link>
      ) : null}
      {showSeniorAgentQaTab ? (
        <Link to="/qa?qaMode=senior_agent_qa" className={tabClass(onSeniorAgentQa)}>
          Senior Agent QA
        </Link>
      ) : null}
      {showAppealsTab ? (
        <Link to="/qa/appeals" className={tabClass(onAppeals)}>
          Appeals
        </Link>
      ) : null}
      {showRandomAudits ? (
        <Link to="/qa/random-audits" className={tabClass(onRandomAudits)}>
          Random Audits
        </Link>
      ) : null}
    </nav>
  );
}
