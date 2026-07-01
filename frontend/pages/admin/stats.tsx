/**
 * Admin global stats route.
 * Shows the admin stats workspace for Product, Marketing, Sales, and Storage lenses.
 */
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import { AdminStatsWorkspace } from "../../features/admin/components/AdminStatsWorkspace";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useAdminGlobalStatsController } from "../../features/admin/logic/useAdminGlobalStatsController";
import { useAdminStorageEconomicsController } from "../../features/admin/logic/useAdminStorageEconomicsController";
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
  const {
    storageEconomics,
    loading: storageLoading,
    error: storageError,
    refresh: refreshStorageEconomics,
  } = useAdminStorageEconomicsController({
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
      metaDescription="Admin stats for product usage, marketing activation, attribution, sales-intent analytics, and storage economics."
      pageTitle="Global stats"
      pageDescription="Track product value, marketing activation, sales-intent analytics, and storage economics from one admin workspace."
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
        storageEconomics={storageEconomics}
        generatedAt={generatedAt}
        loading={statsLoading}
        error={error}
        onRefresh={() => {
          void refresh();
        }}
        storageLoading={storageLoading}
        storageError={storageError}
        onRefreshStorage={() => {
          void refreshStorageEconomics();
        }}
      />
    </AdminRouteShell>
  );
}
