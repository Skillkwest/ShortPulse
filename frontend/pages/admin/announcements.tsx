/**
 * Admin announcements route.
 * Owns the global dashboard bulletin publishing workflow.
 */
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import {
  ADMIN_DASHBOARD_ANNOUNCEMENT_MESSAGE_MAX_LENGTH,
  ADMIN_DASHBOARD_ANNOUNCEMENT_TITLE_MAX_LENGTH,
  useAdminAnnouncementsController,
} from "../../features/admin/logic/useAdminAnnouncementsController";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useProtectedRoute } from "../../lib/authGuard";
import styles from "../../styles/admin.module.css";

export default function AdminAnnouncementsPage() {
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
    announcementCurrent,
    announcementTitle,
    announcementMessage,
    announcementLoading,
    announcementPublishing,
    announcementClearing,
    announcementResult,
    announcementError,
    setAnnouncementTitle,
    setAnnouncementMessage,
    loadCurrentAnnouncement,
    handlePublishAnnouncement,
    handleClearAnnouncement,
  } = useAdminAnnouncementsController({
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
      documentTitle="ShortPulse · Admin Announcements"
      metaDescription="Admin announcement publishing for global dashboard messages."
      pageTitle="Announcements"
      pageDescription="Publish or clear the one global dashboard bulletin without competing with support and incident workflows."
      userEmail={user?.email}
      currentPath="/admin/announcements"
    >
      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className="eyebrow">Current announcement</p>
            <p className="tiny subdued">
              Publish one global announcement shown to all signed-in dashboard users.
            </p>
          </div>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={() => void loadCurrentAnnouncement()}
            disabled={announcementLoading || announcementPublishing || announcementClearing}
          >
            {announcementLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className={styles.announcementFormGrid}>
          <label className={styles.manualAdjustField}>
            <span className="tiny subdued">
              Title ({announcementTitle.trim().length}/
              {ADMIN_DASHBOARD_ANNOUNCEMENT_TITLE_MAX_LENGTH})
            </span>
            <input
              className={styles.searchInput}
              type="text"
              value={announcementTitle}
              onChange={(event) => setAnnouncementTitle(event.target.value)}
              maxLength={ADMIN_DASHBOARD_ANNOUNCEMENT_TITLE_MAX_LENGTH}
              placeholder="Platform notice"
              disabled={announcementPublishing || announcementClearing}
            />
          </label>
          <label className={styles.manualAdjustField}>
            <span className="tiny subdued">
              Message ({announcementMessage.trim().length}/
              {ADMIN_DASHBOARD_ANNOUNCEMENT_MESSAGE_MAX_LENGTH})
            </span>
            <textarea
              className={styles.announcementMessageInput}
              value={announcementMessage}
              onChange={(event) => setAnnouncementMessage(event.target.value)}
              maxLength={ADMIN_DASHBOARD_ANNOUNCEMENT_MESSAGE_MAX_LENGTH}
              placeholder="Tell users what changed and what to expect next."
              rows={5}
              disabled={announcementPublishing || announcementClearing}
            />
          </label>
        </div>

        <div className={styles.announcementActions}>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={() => void handlePublishAnnouncement()}
            disabled={announcementPublishing || announcementClearing || announcementLoading}
          >
            {announcementPublishing ? "Publishing…" : "Publish"}
          </button>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={() => void handleClearAnnouncement()}
            disabled={announcementClearing || announcementPublishing || announcementLoading}
          >
            {announcementClearing ? "Clearing…" : "Clear active announcement"}
          </button>
        </div>

        {announcementError ? <p className={styles.announcementError}>{announcementError}</p> : null}
        {announcementResult ? (
          <p className={styles.announcementResult}>{announcementResult}</p>
        ) : null}

        <div className={styles.announcementPreview}>
          <p className="eyebrow">Live dashboard payload</p>
          {announcementCurrent ? (
            <>
              <p className={styles.announcementPreviewTitle}>{announcementCurrent.title}</p>
              <p className={styles.announcementPreviewMessage}>{announcementCurrent.message}</p>
              <p className="tiny subdued">
                Published{" "}
                {announcementCurrent.publishedAt
                  ? new Date(announcementCurrent.publishedAt).toLocaleString()
                  : "—"}
              </p>
            </>
          ) : (
            <p className="tiny subdued">
              No active announcement. Dashboard users will see fallback helper copy.
            </p>
          )}
        </div>
      </section>
    </AdminRouteShell>
  );
}
