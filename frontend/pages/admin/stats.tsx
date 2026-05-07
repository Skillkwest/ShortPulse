/**
 * Admin global stats route.
 * Shows the admin stats workspace for Product, Marketing, and Sales lenses.
 */
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import { AdminStatsWorkspace } from "../../features/admin/components/AdminStatsWorkspace";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useAdminGlobalStatsController } from "../../features/admin/logic/useAdminGlobalStatsController";
import { useProtectedRoute } from "../../lib/authGuard";

export default function AdminStatsPage() {
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

  return (
    <AdminRouteShell
      loading={loading}
      isAdminEnabled={adminEnabled}
      isAdminAccessLoading={isAdminAccessLoading}
      adminAccessStatus={adminAccessStatus}
      adminAccessError={adminAccessError}
      onRetryAccessCheck={refreshAdminAccess}
      documentTitle="ShortPulse · Admin Stats"
      metaDescription="Admin stats for product usage, marketing activation, attribution, and sales-intent analytics."
      pageTitle="Global stats"
      pageDescription="Track product value, marketing activation, and sales-intent analytics from one admin workspace."
      userEmail={user?.email}
      currentPath="/admin/stats"
    >
      <AdminStatsWorkspace
        overview={overview}
        models={models}
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
