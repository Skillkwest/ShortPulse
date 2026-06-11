/**
 * Admin announcements route.
 * Owns the global dashboard bulletin publishing workflow.
 */
import { useRef, type DragEvent } from "react";
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import { AppMessage } from "../../components/AppMessage";
import {
  ADMIN_DASHBOARD_ANNOUNCEMENT_MESSAGE_MAX_LENGTH,
  ADMIN_DASHBOARD_ANNOUNCEMENT_TITLE_MAX_LENGTH,
  useAdminAnnouncementsController,
} from "../../features/admin/logic/useAdminAnnouncementsController";
import {
  ADMIN_DASHBOARD_TUTORIAL_THUMBNAIL_ALT_MAX_LENGTH,
  ADMIN_DASHBOARD_TUTORIAL_TITLE_MAX_LENGTH,
  useAdminDashboardTutorialsController,
} from "../../features/admin/logic/useAdminDashboardTutorialsController";
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
  const {
    tutorials,
    draft: tutorialDraft,
    loading: tutorialsLoading,
    saving: tutorialSaving,
    uploadingThumbnail,
    deletingId: tutorialDeletingId,
    reorderingId: tutorialReorderingId,
    result: tutorialResult,
    error: tutorialError,
    updateDraft: updateTutorialDraft,
    uploadThumbnail,
    startNewTutorial,
    editTutorial,
    loadTutorials,
    saveDraft: saveTutorialDraft,
    deleteTutorial,
    moveTutorial,
  } = useAdminDashboardTutorialsController({
    enabled: Boolean(user && adminEnabled),
  });
  const thumbnailFileInputRef = useRef<HTMLInputElement | null>(null);
  const tutorialFormLocked = tutorialSaving || uploadingThumbnail;

  const handleThumbnailFileSelection = (files: FileList | null) => {
    const file = files?.[0] ?? null;
    if (thumbnailFileInputRef.current) {
      thumbnailFileInputRef.current.value = "";
    }
    if (file) {
      void uploadThumbnail(file);
    }
  };

  const handleThumbnailDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (tutorialFormLocked) return;
    handleThumbnailFileSelection(event.dataTransfer.files);
  };

  return (
    <AdminRouteShell
      loading={loading}
      isAdminEnabled={adminEnabled}
      isAdminAccessLoading={isAdminAccessLoading}
      adminAccessStatus={adminAccessStatus}
      adminAccessError={adminAccessError}
      onRetryAccessCheck={refreshAdminAccess}
      documentTitle="ShortPulse · Admin Dashboard"
      metaDescription="Admin dashboard management for announcements and tutorial cards."
      pageTitle="Dashboard"
      pageDescription="Manage the signed-in homepage announcement and global tutorial hub."
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

        {announcementError ? (
          <AppMessage
            className={styles.announcementError}
            tone="error"
            mode="banner"
            message={announcementError}
          />
        ) : null}
        {announcementResult ? (
          <AppMessage
            className={styles.announcementResult}
            tone="success"
            mode="banner"
            message={announcementResult}
          />
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

      <section className={styles.adminSection}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className="eyebrow">Tutorial hub</p>
            <p className="tiny subdued">
              Add, edit, activate, and reorder tutorial cards shown on every signed-in dashboard.
            </p>
          </div>
          <div className={styles.dashboardTutorialActions}>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={() => startNewTutorial()}
              disabled={tutorialFormLocked || tutorialsLoading}
            >
              New tutorial
            </button>
            <button
              type="button"
              className="ghost-btn mini"
              onClick={() => void loadTutorials()}
              disabled={tutorialFormLocked || tutorialsLoading}
            >
              {tutorialsLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        <div className={styles.dashboardTutorialManager}>
          <div className={styles.dashboardTutorialPreviewGrid}>
            {tutorials.length > 0 ? (
              tutorials.map((tutorial, index) => (
                <article
                  key={tutorial.id}
                  className={`${styles.dashboardTutorialPreviewCard} ${
                    tutorial.isActive ? "" : styles.dashboardTutorialPreviewInactive
                  }`}
                >
                  <button
                    type="button"
                    className={styles.dashboardTutorialPreviewButton}
                    onClick={() => editTutorial(tutorial)}
                  >
                    <span className={styles.dashboardTutorialPreviewMedia} aria-hidden="true">
                      {tutorial.thumbnailMediaType === "video" ? (
                        <video
                          src={tutorial.thumbnailUrl}
                          muted
                          loop
                          playsInline
                          autoPlay
                          preload="metadata"
                        />
                      ) : (
                        <span
                          className={styles.dashboardTutorialPreviewImage}
                          style={{
                            backgroundImage: `url(${JSON.stringify(tutorial.thumbnailUrl)})`,
                          }}
                        />
                      )}
                    </span>
                    <span className={styles.dashboardTutorialPreviewTitle}>{tutorial.title}</span>
                    <span className="tiny subdued">
                      {tutorial.isActive ? "Active" : "Inactive"} · Order {tutorial.displayOrder}
                    </span>
                  </button>
                  <div className={styles.dashboardTutorialCardActions}>
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => void moveTutorial(tutorial.id, "up")}
                      disabled={
                        index === 0 ||
                        tutorialReorderingId !== null ||
                        tutorialFormLocked ||
                        tutorialsLoading
                      }
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => void moveTutorial(tutorial.id, "down")}
                      disabled={
                        index === tutorials.length - 1 ||
                        tutorialReorderingId !== null ||
                        tutorialFormLocked ||
                        tutorialsLoading
                      }
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="ghost-btn mini"
                      onClick={() => void deleteTutorial(tutorial.id)}
                      disabled={tutorialDeletingId === tutorial.id || tutorialFormLocked}
                    >
                      {tutorialDeletingId === tutorial.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className={styles.announcementPreview}>
                <p className="eyebrow">No tutorials yet</p>
                <p className="tiny subdued">
                  Add the first tutorial card to populate the signed-in dashboard hub.
                </p>
              </div>
            )}
          </div>

          <div className={styles.dashboardTutorialForm}>
            <div className={styles.adminSectionHead}>
              <div>
                <p className="eyebrow">{tutorialDraft.id ? "Edit tutorial" : "Add tutorial"}</p>
                <p className="tiny subdued">
                  Drop a thumbnail file here or use an HTTPS asset with a YouTube destination.
                </p>
              </div>
            </div>

            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">
                Title ({tutorialDraft.title.trim().length}/
                {ADMIN_DASHBOARD_TUTORIAL_TITLE_MAX_LENGTH})
              </span>
              <input
                className={styles.searchInput}
                type="text"
                value={tutorialDraft.title}
                onChange={(event) => updateTutorialDraft({ title: event.target.value })}
                maxLength={ADMIN_DASHBOARD_TUTORIAL_TITLE_MAX_LENGTH}
                placeholder="Create your first project"
                disabled={tutorialFormLocked}
              />
            </label>

            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">YouTube URL</span>
              <input
                className={styles.searchInput}
                type="url"
                value={tutorialDraft.youtubeUrl}
                onChange={(event) => updateTutorialDraft({ youtubeUrl: event.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={tutorialFormLocked}
              />
            </label>

            <div className={styles.manualAdjustField}>
              <span className="tiny subdued">Thumbnail file</span>
              <div
                className={styles.dashboardTutorialUploadDropzone}
                onDrop={handleThumbnailDrop}
                onDragOver={(event) => event.preventDefault()}
              >
                <input
                  ref={thumbnailFileInputRef}
                  className={styles.visuallyHiddenInput}
                  id="dashboard-tutorial-thumbnail-upload"
                  type="file"
                  accept="image/gif,image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                  onChange={(event) => handleThumbnailFileSelection(event.target.files)}
                  disabled={tutorialFormLocked}
                />
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={() => thumbnailFileInputRef.current?.click()}
                  disabled={tutorialFormLocked}
                >
                  {uploadingThumbnail ? "Uploading..." : "Choose file"}
                </button>
                <span className="tiny subdued">GIF, image, MP4, MOV, or WebM up to 50 MB.</span>
              </div>
              {tutorialDraft.thumbnailUrl ? (
                <div className={styles.dashboardTutorialUploadPreview}>
                  <span className={styles.dashboardTutorialPreviewMedia} aria-hidden="true">
                    {tutorialDraft.thumbnailMediaType === "video" ? (
                      <video
                        src={tutorialDraft.thumbnailUrl}
                        muted
                        loop
                        playsInline
                        autoPlay
                        preload="metadata"
                      />
                    ) : (
                      <span
                        className={styles.dashboardTutorialPreviewImage}
                        style={{
                          backgroundImage: `url(${JSON.stringify(tutorialDraft.thumbnailUrl)})`,
                        }}
                      />
                    )}
                  </span>
                  <span className="tiny subdued">
                    {tutorialDraft.thumbnailStoragePath ? "Uploaded thumbnail" : "External URL"}
                  </span>
                </div>
              ) : null}
            </div>

            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">Thumbnail URL fallback</span>
              <input
                className={styles.searchInput}
                type="url"
                value={tutorialDraft.thumbnailStoragePath ? "" : tutorialDraft.thumbnailUrl}
                onChange={(event) =>
                  updateTutorialDraft({
                    thumbnailUrl: event.target.value,
                    thumbnailStoragePath: null,
                    thumbnailFileSizeBytes: null,
                    thumbnailContentType: null,
                  })
                }
                placeholder="https://..."
                disabled={tutorialFormLocked}
              />
            </label>

            <div className={styles.dashboardTutorialFormRow}>
              <label className={styles.manualAdjustField}>
                <span className="tiny subdued">Thumbnail type</span>
                <select
                  className={styles.searchInput}
                  value={tutorialDraft.thumbnailMediaType}
                  onChange={(event) =>
                    updateTutorialDraft({
                      thumbnailMediaType: event.target.value === "video" ? "video" : "image",
                    })
                  }
                  disabled={tutorialFormLocked}
                >
                  <option value="image">Image / GIF</option>
                  <option value="video">Video</option>
                </select>
              </label>

              <label className={styles.manualAdjustField}>
                <span className="tiny subdued">Display order</span>
                <input
                  className={styles.searchInput}
                  type="number"
                  min="0"
                  value={tutorialDraft.displayOrder}
                  onChange={(event) => updateTutorialDraft({ displayOrder: event.target.value })}
                  disabled={tutorialFormLocked}
                />
              </label>
            </div>

            <label className={styles.manualAdjustField}>
              <span className="tiny subdued">
                Thumbnail alt ({tutorialDraft.thumbnailAlt.trim().length}/
                {ADMIN_DASHBOARD_TUTORIAL_THUMBNAIL_ALT_MAX_LENGTH})
              </span>
              <input
                className={styles.searchInput}
                type="text"
                value={tutorialDraft.thumbnailAlt}
                onChange={(event) => updateTutorialDraft({ thumbnailAlt: event.target.value })}
                maxLength={ADMIN_DASHBOARD_TUTORIAL_THUMBNAIL_ALT_MAX_LENGTH}
                placeholder="Animated preview of the tutorial"
                disabled={tutorialFormLocked}
              />
            </label>

            <label className={styles.dashboardTutorialToggle}>
              <input
                type="checkbox"
                checked={tutorialDraft.isActive}
                onChange={(event) => updateTutorialDraft({ isActive: event.target.checked })}
                disabled={tutorialFormLocked}
              />
              <span>Show this tutorial on user dashboards</span>
            </label>

            <div className={styles.announcementActions}>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => void saveTutorialDraft()}
                disabled={tutorialFormLocked || tutorialsLoading}
              >
                {tutorialSaving ? "Saving…" : "Save tutorial"}
              </button>
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => startNewTutorial()}
                disabled={tutorialFormLocked}
              >
                Clear form
              </button>
            </div>
          </div>
        </div>

        {tutorialError ? (
          <AppMessage
            className={styles.announcementError}
            tone="error"
            mode="banner"
            message={tutorialError}
          />
        ) : null}
        {tutorialResult ? (
          <AppMessage
            className={styles.announcementResult}
            tone="success"
            mode="banner"
            message={tutorialResult}
          />
        ) : null}
      </section>
    </AdminRouteShell>
  );
}
