/**
 * Admin Legal route.
 * Hosts the global legal policy document management workspace.
 */
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import { AdminLegalPoliciesSection } from "../../features/admin/legal/components/AdminLegalPoliciesSection";
import { useAdminLegalPoliciesController } from "../../features/admin/legal/logic/useAdminLegalPoliciesController";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useProtectedRoute } from "../../lib/authGuard";

export default function AdminLegalPage() {
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
  const legalController = useAdminLegalPoliciesController({
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
      documentTitle="ShortPulse · Admin Legal"
      metaDescription="Admin legal document management for ShortPulse policy pages."
      pageTitle="Legal"
      pageDescription="Manage the public Terms of Service, Privacy Policy, and Refund Policy documents."
      userEmail={user?.email}
      currentPath="/admin/legal"
    >
      <AdminLegalPoliciesSection
        documents={legalController.documents}
        selectedSlug={legalController.selectedSlug}
        selectedDocument={legalController.selectedDocument}
        draftMarkdown={legalController.draftMarkdown}
        publishNote={legalController.publishNote}
        loading={legalController.loading}
        publishing={legalController.publishing}
        uploadReading={legalController.uploadReading}
        error={legalController.error}
        result={legalController.result}
        onSelectSlug={legalController.setSelectedSlug}
        onChangeDraftMarkdown={legalController.setDraftMarkdown}
        onChangePublishNote={legalController.setPublishNote}
        onRefresh={() => void legalController.loadPolicies()}
        onResetDraft={legalController.resetDraftToLive}
        onReadUploadFile={(file) => void legalController.readUploadFile(file)}
        onPublish={() => void legalController.publishSelectedPolicy()}
      />
    </AdminRouteShell>
  );
}
