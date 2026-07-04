/**
 * Admin storage route.
 * Shows provider usage snapshots, product-tracked media storage, add-on capacity, and quota risk.
 */
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import { AdminStorageEconomicsPanel } from "../../features/admin/components/AdminStorageEconomicsPanel";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useAdminStorageEconomicsController } from "../../features/admin/logic/useAdminStorageEconomicsController";
import { useProtectedRoute } from "../../lib/authGuard";

export default function AdminStoragePage() {
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
      documentTitle="ShortPulse · Admin Storage"
      metaDescription="Admin storage view for Supabase usage snapshots, product-tracked media usage, add-on capacity, and local quota risk."
      pageTitle="Storage"
      pageDescription="Track Supabase usage snapshots, product-tracked media usage, recurring storage add-ons, and local capacity risk."
      userEmail={user?.email}
      currentPath="/admin/storage"
    >
      <AdminStorageEconomicsPanel
        storageEconomics={storageEconomics}
        loading={storageLoading}
        error={storageError}
        onRefresh={() => {
          void refreshStorageEconomics();
        }}
      />
    </AdminRouteShell>
  );
}
