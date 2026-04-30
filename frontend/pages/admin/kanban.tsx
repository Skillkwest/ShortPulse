/**
 * Admin kanban page.
 * Hosts the operator task board as a dedicated admin workspace.
 */
import { AdminKanbanBoardSection } from "../../features/admin/components/AdminKanbanBoardSection";
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useProtectedRoute } from "../../lib/authGuard";

/**
 * Renders the standalone admin task board route.
 */
export default function AdminKanbanPage() {
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

  return (
    <AdminRouteShell
      loading={loading}
      isAdminEnabled={adminEnabled}
      isAdminAccessLoading={isAdminAccessLoading}
      adminAccessStatus={adminAccessStatus}
      adminAccessError={adminAccessError}
      onRetryAccessCheck={refreshAdminAccess}
      documentTitle="ShortPulse · Admin Kanban"
      metaDescription="Admin kanban workspace for operator task tracking."
      pageTitle="Kanban board"
      pageDescription="Track shared operator tasks from backlog through published without mixing task planning into support account workflows."
      userEmail={user?.email}
      currentPath="/admin/kanban"
    >
      <AdminKanbanBoardSection />
    </AdminRouteShell>
  );
}
