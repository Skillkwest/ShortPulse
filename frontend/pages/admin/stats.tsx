/**
 * Admin global stats route.
 * Shows the admin stats v1 workspace for overview, models, workflows,
 * assets, and project activity.
 */
import { AdminGlobalStatsPanel } from "../../features/admin/components/AdminGlobalStatsPanel";
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
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
  });
  const {
    overview,
    models,
    workflows,
    assets,
    projects,
    health,
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
      metaDescription="Admin stats for global generation usage, workflow adoption, saved assets, and project activity."
      pageTitle="Global stats"
      pageDescription="Track the highest-signal admin metrics first: model demand, workflow usage, saved assets, and project-attached work."
      userEmail={user?.email}
      currentPath="/admin/stats"
    >
      <AdminGlobalStatsPanel
        overview={overview}
        models={models}
        workflows={workflows}
        assets={assets}
        projects={projects}
        health={health}
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
