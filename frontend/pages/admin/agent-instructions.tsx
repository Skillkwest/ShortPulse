import { AdminAgentInstructionsSection } from "../../features/admin/components/AdminAgentInstructionsSection";
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useProtectedRoute } from "../../lib/authGuard";
import styles from "../../styles/admin.module.css";

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
    userId: user?.id ?? null,
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
      metaDescription="Admin workspace for editing the shared Standard prompt, Style Extraction prompt, Edit system preset catalog, and Create Pulse built-ins."
      pageTitle="Agent instructions"
      pageDescription="Review the shared Standard prompt, Style Extraction prompt, Edit system preset catalog, and Create Pulse built-ins."
      userEmail={user?.email}
      currentPath="/admin/agent-instructions"
      renderBareNav
      mainClassName={styles.adminAgentInstructionsPage}
    >
      <AdminAgentInstructionsSection />
    </AdminRouteShell>
  );
}
