import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export type QaWorkflowConfig = {
  appealWindowDays: number;
  escalationWindowDays: number;
  acknowledgementOverdueDays: number | null;
};

export type KpiReportingConfig = {
  launchDateIst: string | null;
};

export function useAdminHandbookSettings(enabled = true) {
  const { effective } = useAuth();
  const isAdmin = effective?.roleKey === "admin";
  const canReadQaConfig =
    isAdmin ||
    effective?.roleKey === "supervisor" ||
    effective?.roleKey === "senior_agent" ||
    effective?.roleKey === "agent";

  const qa = useQuery({
    queryKey: ["handbook-qa-workflow-config"],
    queryFn: () => api<{ config: QaWorkflowConfig }>("/api/qa/workflow-config"),
    enabled: enabled && canReadQaConfig,
    staleTime: 60_000,
  });

  const reporting = useQuery({
    queryKey: ["handbook-kpi-reporting"],
    queryFn: () => api<{ reporting: KpiReportingConfig }>("/api/kpi/reporting"),
    enabled: enabled && isAdmin,
    staleTime: 60_000,
  });

  return {
    qa,
    qaLoading: qa.isLoading,
    qaError: qa.isError,
    reporting,
    reportingLoading: reporting.isLoading,
    reportingError: reporting.isError,
  };
}
