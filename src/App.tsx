import { Navigate, Outlet, Route, Routes, useParams } from "react-router-dom";
import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { useAuth } from "@/lib/auth";
import { AuditPage, FreshdeskPage, PeoplePage } from "@/pages/admin";
import { DashboardPage } from "@/pages/dashboard";
import { EscalationsPage } from "@/pages/escalations";
import { KpiPage } from "@/pages/kpi";
import { GuideFormPage, GuidePage, KnowledgePage } from "@/pages/knowledge";
import { ProductGuideDetailPage, ProductGuideFormPage, ProductGuidesPage } from "@/pages/product-guides";
import { FeatureImpactDetailPage, FeatureImpactFormPage, FeatureImpactsPage } from "@/pages/feature-impacts";
import { IntegrationStepsRoutes } from "@/pages/integration-steps";
import { ProductFeedbackRoutes } from "@/pages/product-feedback";
import { SupportedFilesRoutes } from "@/pages/supported-files";
import { NegativeReviewsRoutes } from "@/pages/negative-reviews";
import { TokenMigrationRoutes } from "@/pages/token-migration";
import { KnowledgeBaseRoutes } from "@/pages/knowledge-base";
import {
  SupportActionCreatePage,
  SupportActionDetailPage,
  SupportActionsListPage,
} from "@/pages/support-actions";
import { PasswordPage, ProfilePage, ViewAsPage } from "@/pages/account";
import { LoginPage } from "@/pages/login";
import { QaDetailPage, QaFormPage, QaListPage } from "@/pages/qa";
import { TasksPage } from "@/pages/tasks";
import { SupportUpdatesPage } from "@/pages/support-updates";
import { ReportedIssuesPage, ReportedIssueDetailPage } from "@/pages/reported-issues";
import { WeeklyPage } from "@/pages/weekly";

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

function SupportActionDetailRoute() {
  const { id } = useParams();
  if (!id) return <Navigate to="/support-actions" replace />;
  return <SupportActionDetailPage id={id} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AuthLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/account" element={<ProfilePage />} />
        <Route path="/account/password" element={<PasswordPage />} />
        <Route path="/view-as" element={<Permit any={["view_as"]}><ViewAsPage /></Permit>} />
        <Route path="/kpi" element={<Permit any={["kpi.view_team", "kpi.view_own"]}><KpiPage /></Permit>} />
        <Route path="/qa" element={<Permit any={["qa.view_team", "qa.view_own", "qa.create"]}><QaListPage /></Permit>} />
        <Route path="/qa/new" element={<Writes><Permit any={["qa.create"]}><QaFormPage /></Permit></Writes>} />
        <Route path="/qa/:id/edit" element={<Writes><Permit any={["qa.edit"]}><QaFormPage /></Permit></Writes>} />
        <Route path="/qa/:id" element={<Permit any={["qa.view_team", "qa.view_own"]}><QaDetailPage /></Permit>} />
        <Route path="/knowledge" element={<Permit any={["guides.view"]}><KnowledgePage /></Permit>} />
        <Route path="/knowledge/new" element={<Writes><Permit any={["guides.edit"]}><GuideFormPage /></Permit></Writes>} />
        <Route path="/knowledge/:id/edit" element={<Writes><Permit any={["guides.edit"]}><GuideFormPage /></Permit></Writes>} />
        <Route path="/knowledge/:id" element={<Permit any={["guides.view"]}><GuidePage /></Permit>} />
        <Route path="/product-guides" element={<Permit any={["guides.view"]}><ProductGuidesPage /></Permit>} />
        <Route path="/product-guides/new" element={<Writes><Permit any={["guides.manage"]}><ProductGuideFormPage /></Permit></Writes>} />
        <Route path="/product-guides/:id/edit" element={<Writes><Permit any={["guides.manage"]}><ProductGuideFormPage /></Permit></Writes>} />
        <Route path="/product-guides/:id" element={<Permit any={["guides.view"]}><ProductGuideDetailPage /></Permit>} />
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
        <Route path="/escalations" element={<Permit any={["escalations.view_team", "escalations.view_own"]}><EscalationsPage /></Permit>} />
        <Route path="/tasks" element={<Permit any={["tasks.view_team", "tasks.view_own"]}><TasksPage /></Permit>} />
        <Route path="/support-actions" element={<Permit any={["support_actions.view"]}><SupportActionsListPage /></Permit>} />
        <Route path="/support-actions/new" element={<Writes><Permit any={["support_actions.create"]}><SupportActionCreatePage /></Permit></Writes>} />
        <Route path="/support-updates" element={<Permit any={["support_updates.view"]}><SupportUpdatesPage /></Permit>} />
        <Route path="/reported-issues" element={<Permit any={["reported_issues.view_all", "reported_issues.view_own"]}><ReportedIssuesPage /></Permit>} />
        <Route path="/reported-issues/:id" element={<Permit any={["reported_issues.view_all", "reported_issues.view_own"]}><ReportedIssueDetailPage /></Permit>} />
        <Route
          path="/support-actions/:id"
          element={
            <Permit any={["support_actions.view"]}>
              <SupportActionDetailRoute />
            </Permit>
          }
        />
        <Route path="/weekly" element={<Permit any={["weekly.view"]}><WeeklyPage /></Permit>} />
        <Route path="/admin/people" element={<Permit any={["users.manage"]}><PeoplePage /></Permit>} />
        <Route path="/admin/freshdesk" element={<Permit any={["freshdesk.manage"]}><FreshdeskPage /></Permit>} />
        <Route path="/admin/audit" element={<Permit any={["audit.view"]}><AuditPage /></Permit>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
