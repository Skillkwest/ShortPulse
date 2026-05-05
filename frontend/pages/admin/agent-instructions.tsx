import { AdminAgentInstructionsSection } from "../../features/admin/components/AdminAgentInstructionsSection";
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useProtectedRoute } from "../../lib/authGuard";

export default function AdminAgentInstructionsPage() {
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
      documentTitle="ShortPulse · Admin Agent Instructions"
      metaDescription="Admin workspace for editing the built-in Create Pulse agent instructions."
      pageTitle="Agent instructions"
      pageDescription="Review and edit the built-in Create Pulse agents with simplified name, description, and system-instructions fields."
      userEmail={user?.email}
      currentPath="/admin/agent-instructions"
    >
      <AdminAgentInstructionsSection />
    </AdminRouteShell>
  );
}
