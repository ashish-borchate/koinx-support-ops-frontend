import type { ReactNode } from "react";
import { PageHeader } from "@/components/bits";
import { QaModuleNav } from "@/components/qa-module-nav";
import { useSearchParams } from "react-router-dom";

export function useQaPerformanceDescription() {
  const [params] = useSearchParams();
  const isSeniorMode = params.get("qaMode") === "senior_agent_qa";
  if (isSeniorMode) return "Supervisor reviews of cases personally handled by Senior Agents.";
  return "Quality evaluations of Agent-handled customer cases.";
}

export function QaPerformanceHeader() {
  return (
    <PageHeader title="QA Performance" description={useQaPerformanceDescription()} className="mb-2" />
  );
}

export function QaSectionShell({
  sectionTitle,
  children,
}: {
  sectionTitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <QaPerformanceHeader />
      <QaModuleNav />
      {sectionTitle ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Quality Assurance</p>
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">{sectionTitle}</h2>
        </div>
      ) : null}
      {children}
    </div>
  );
}
