import { Navigate, Outlet, Route, Routes, useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { useAuth } from "@/lib/auth";
import { PeoplePage } from "@/pages/admin";
import { DashboardPage } from "@/pages/dashboard";
import { KpiPage } from "@/pages/kpi";
import { ProductGuidesRoutes } from "@/pages/product-guides";
import { FeatureImpactDetailPage, FeatureImpactFormPage, FeatureImpactsPage } from "@/pages/feature-impacts";
import { IntegrationStepsRoutes } from "@/pages/integration-steps";
import { ProductFeedbackRoutes } from "@/pages/product-feedback";
import { SupportedFilesRoutes } from "@/pages/supported-files";
import { NegativeReviewsRoutes, NrDailyDsatPage } from "@/pages/negative-reviews";
import { TokenMigrationRoutes } from "@/pages/token-migration";
import { KnowledgeBaseRoutes } from "@/pages/knowledge-base";
import { PasswordPage, ProfilePage, ViewAsPage } from "@/pages/account";
import { LoginPage } from "@/pages/login";
import { AcceptInvitePage } from "@/pages/accept-invite";
import { ForgotPasswordPage } from "@/pages/forgot-password";
import { ResetPasswordPage } from "@/pages/reset-password";
import { PrivacyPolicyPage } from "@/pages/privacy";
import { QaDetailPage, QaFormPage, QaListPage } from "@/pages/qa";
import { QaRandomAuditsPage } from "@/pages/qa-random-audits";
import { QaAppealDetailPage, QaAppealsPage } from "@/pages/qa-appeals";
import { CoachingPage } from "@/pages/coaching";
import { ManagementOverviewPage } from "@/pages/management-overview";
import { SupportUpdatesPage } from "@/pages/support-updates";
import { DeletedReportedIssuesPage, ReportedIssuesPage, ReportedIssueDetailPage } from "@/pages/reported-issues";
function AuthLayout() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-8 text-sm text-muted-foreground">
        Checking your session…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

function Permit({ any, children }: { any: string[]; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(...any)) return <Navigate to="/" replace />;
  return children;
}

function Writes({ children }: { children: ReactNode }) {
  const { readOnly } = useAuth();
  if (readOnly) return <Navigate to="/" replace />;
  return children;
}

function QaNewRoute() {
  const { can } = useAuth();
  const [params] = useSearchParams();
  const senior = params.get("qaMode") === "senior_agent_qa";
  if (senior && !can("qa.senior_agent_qa")) return <Navigate to="/qa" replace />;
  if (!senior && !can("qa.create")) return <Navigate to="/qa" replace />;
  return <QaFormPage />;
}

function QaEditRoute() {
  const { can } = useAuth();
  return can("qa.edit") || can("qa.senior_agent_qa") ? <QaFormPage /> : <Navigate to="/qa" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route element={<AuthLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/account" element={<ProfilePage />} />
        <Route path="/account/password" element={<PasswordPage />} />
        <Route path="/view-as" element={<Permit any={["view_as"]}><ViewAsPage /></Permit>} />
        <Route path="/kpi" element={<Permit any={["kpi.view_team", "kpi.view_own"]}><KpiPage /></Permit>} />
        <Route path="/management" element={<Permit any={["management.view"]}><ManagementOverviewPage /></Permit>} />
        <Route path="/daily-dsat" element={<NrDailyDsatPage />} />
        <Route path="/qa" element={<Permit any={["qa.view_team", "qa.view_own", "qa.create"]}><QaListPage /></Permit>} />
        <Route path="/qa/random-audits" element={<Permit any={["qa.random_audit.view_team"]}><QaRandomAuditsPage /></Permit>} />
        <Route path="/qa/appeals" element={<Permit any={["qa.view_team", "qa.view_own"]}><QaAppealsPage /></Permit>} />
        <Route path="/qa/appeals/:appealId" element={<Permit any={["qa.view_team", "qa.view_own"]}><QaAppealDetailPage /></Permit>} />
        <Route path="/qa/new" element={<Writes><QaNewRoute /></Writes>} />
        <Route path="/qa/:id/edit" element={<Writes><QaEditRoute /></Writes>} />
        <Route path="/qa/:id" element={<Permit any={["qa.view_team", "qa.view_own"]}><QaDetailPage /></Permit>} />
        <Route path="/coaching" element={<Permit any={["coaching.view_team", "coaching.view_own"]}><CoachingPage /></Permit>} />
        <Route path="/knowledge/*" element={<Navigate to="/integration-steps/tracker" replace />} />
        <Route
          path="/product-guides/*"
          element={
            <Permit any={["guides.view"]}>
              <ProductGuidesRoutes />
            </Permit>
          }
        />
        <Route path="/feature-impacts" element={<Permit any={["feature_impact.view", "guides.manage"]}><FeatureImpactsPage /></Permit>} />
        <Route path="/feature-impacts/new" element={<Writes><Permit any={["feature_impact.manage"]}><FeatureImpactFormPage /></Permit></Writes>} />
        <Route path="/feature-impacts/:id/edit" element={<Writes><Permit any={["feature_impact.manage"]}><FeatureImpactFormPage /></Permit></Writes>} />
        <Route path="/feature-impacts/:id" element={<Permit any={["feature_impact.view", "guides.manage"]}><FeatureImpactDetailPage /></Permit>} />
        <Route
          path="/integration-steps/*"
          element={
            <Permit any={["integration.dashboard", "integration.tracker", "integration.library", "integration.tech", "integration.view", "integration.manage", "integration.review"]}>
              <IntegrationStepsRoutes />
            </Permit>
          }
        />
        <Route
          path="/product-feedback/*"
          element={
            <Permit any={["feedback.submit", "feedback.view"]}>
              <ProductFeedbackRoutes />
            </Permit>
          }
        />
        <Route
          path="/supported-files/*"
          element={
            <Permit any={["supported_files.dashboard", "supported_files.tracker"]}>
              <SupportedFilesRoutes />
            </Permit>
          }
        />
        <Route
          path="/negative-reviews/*"
          element={
            <Permit any={["negative_reviews.dashboard", "negative_reviews.tracker"]}>
              <NegativeReviewsRoutes />
            </Permit>
          }
        />
        <Route
          path="/token-migration/*"
          element={
            <Permit any={["token_migration.dashboard", "token_migration.tracker"]}>
              <TokenMigrationRoutes />
            </Permit>
          }
        />
        <Route
          path="/knowledge-base/*"
          element={
            <Permit any={["knowledge_base.view"]}>
              <KnowledgeBaseRoutes />
            </Permit>
          }
        />
        <Route path="/escalations" element={<Navigate to="/" replace />} />
        <Route path="/tasks" element={<Navigate to="/reported-issues" replace />} />
        <Route path="/support-actions" element={<Navigate to="/reported-issues" replace />} />
        <Route path="/support-actions/*" element={<Navigate to="/reported-issues" replace />} />
        <Route path="/support-updates" element={<Permit any={["support_updates.view"]}><SupportUpdatesPage /></Permit>} />
        <Route path="/reported-issues" element={<Permit any={["reported_issues.view_all", "reported_issues.view_own"]}><ReportedIssuesPage /></Permit>} />
        <Route path="/reported-issues/deleted" element={<Permit any={["reported_issues.view_all"]}><DeletedReportedIssuesPage /></Permit>} />
        <Route path="/reported-issues/:id" element={<Permit any={["reported_issues.view_all", "reported_issues.view_own"]}><ReportedIssueDetailPage /></Permit>} />
        <Route path="/weekly" element={<Navigate to="/" replace />} />
        <Route path="/admin/people" element={<Permit any={["users.manage"]}><PeoplePage /></Permit>} />
        <Route path="/admin/freshdesk" element={<Navigate to="/" replace />} />
        <Route path="/admin/audit" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
