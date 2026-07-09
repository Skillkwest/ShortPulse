/**
 * Admin global stats route.
 * Shows the admin analytics workspace for Product, Marketing, and Sales lenses.
 */
import { useRouter } from "next/router";
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import { AdminCustomerAnalyticsPanel } from "../../features/admin/components/AdminCustomerAnalyticsPanel";
import { AdminStatsWorkspace } from "../../features/admin/components/AdminStatsWorkspace";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useAdminCustomerAnalyticsController } from "../../features/admin/logic/useAdminCustomerAnalyticsController";
import { useAdminGlobalStatsController } from "../../features/admin/logic/useAdminGlobalStatsController";
import { useProtectedRoute } from "../../lib/authGuard";

const formatUsd = (value: number | null): string => (value == null ? "—" : `$${value.toFixed(2)}`);

const asSingleQueryString = (value: string | string[] | undefined): string | null => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
};

export default function AdminStatsPage() {
  const router = useRouter();
  const { loading, user } = useProtectedRoute(true);
  const {
    status: adminAccessStatus,
    isLoading: isAdminAccessLoading,
    isAdmin: adminEnabled,
    error: adminAccessError,
    refresh: refreshAdminAccess,
  } = useAdminAccess({
    enabled: Boolean(user),
    userId: user?.id ?? null,
  });
  const {
    overview,
    models,
    generationBreakdown,
    workflows,
    assets,
    projects,
    health,
    growth,
    generatedAt,
    loading: statsLoading,
    error,
    refresh,
  } = useAdminGlobalStatsController({
    enabled: Boolean(user && adminEnabled),
  });
  const customerAnalyticsController = useAdminCustomerAnalyticsController({
    enabled: Boolean(user && adminEnabled),
    initialCustomerId:
      asSingleQueryString(router.query.customerId) ?? asSingleQueryString(router.query.userId),
  });
  return (
    <AdminRouteShell
      loading={loading}
      isAdminEnabled={adminEnabled}
      isAdminAccessLoading={isAdminAccessLoading}
      adminAccessStatus={adminAccessStatus}
      adminAccessError={adminAccessError}
      onRetryAccessCheck={refreshAdminAccess}
      documentTitle="ShortPulse · Admin Stats"
      metaDescription="Admin analytics for product usage, marketing activation, attribution, and sales-intent analytics."
      pageTitle="Global stats"
      pageDescription="Track product value, marketing activation, and sales-intent analytics from one admin workspace."
      userEmail={user?.email}
      currentPath="/admin/stats"
    >
      <AdminCustomerAnalyticsPanel
        customerIdInput={customerAnalyticsController.customerIdInput}
        activeCustomerId={customerAnalyticsController.activeCustomerId}
        analytics={customerAnalyticsController.analytics}
        loading={customerAnalyticsController.loading}
        error={customerAnalyticsController.error}
        loaded={customerAnalyticsController.loaded}
        setCustomerIdInput={customerAnalyticsController.setCustomerIdInput}
        loadCustomerAnalytics={customerAnalyticsController.loadCustomerAnalytics}
        formatUsd={formatUsd}
      />
      <AdminStatsWorkspace
        overview={overview}
        models={models}
        generationBreakdown={generationBreakdown}
        workflows={workflows}
        assets={assets}
        projects={projects}
        health={health}
        growth={growth}
        generatedAt={generatedAt}
        loading={statsLoading}
        error={error}
        onRefresh={() => {
          void refresh();
        }}
      />
    </AdminRouteShell>
  );
}
