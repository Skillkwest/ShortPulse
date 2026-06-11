/**
 * Admin announcements route.
 * Owns the global dashboard bulletin publishing workflow.
 */
import { useRef, useState, type DragEvent } from "react";
import { Trash } from "phosphor-react";
import { AdminRouteShell } from "../../features/admin/components/AdminRouteShell";
import { AppMessage } from "../../components/AppMessage";
import {
  ADMIN_DASHBOARD_ANNOUNCEMENT_MESSAGE_MAX_LENGTH,
  ADMIN_DASHBOARD_ANNOUNCEMENT_TITLE_MAX_LENGTH,
  useAdminAnnouncementsController,
} from "../../features/admin/logic/useAdminAnnouncementsController";
import {
  ADMIN_DASHBOARD_TUTORIAL_TITLE_MAX_LENGTH,
  useAdminDashboardTutorialsController,
} from "../../features/admin/logic/useAdminDashboardTutorialsController";
import { useAdminAccess } from "../../features/admin/logic/useAdminAccess";
import { useProtectedRoute } from "../../lib/authGuard";
import styles from "../../styles/admin.module.css";

const ADMIN_TUTORIAL_GRID_SLOT_COUNT = 25;

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
    reorderTutorials,
  } = useAdminDashboardTutorialsController({
    enabled: Boolean(user && adminEnabled),
  });
  const thumbnailFileInputRef = useRef<HTMLInputElement | null>(null);
  const [draggedTutorialId, setDraggedTutorialId] = useState<string | null>(null);
  const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null);
  const tutorialFormLocked = tutorialSaving || uploadingThumbnail;
  const tutorialGridLocked =
    tutorialFormLocked || tutorialsLoading || tutorialReorderingId !== null;
  const tutorialGridSlots = Array.from(
    { length: Math.max(ADMIN_TUTORIAL_GRID_SLOT_COUNT, tutorials.length) },
    (_, index) => tutorials[index] ?? null
  );

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

  const handleTutorialDragStart = (event: DragEvent<HTMLElement>, tutorialId: string) => {
    if (tutorialGridLocked) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", tutorialId);
    setDraggedTutorialId(tutorialId);
  };

  const handleTutorialDragOver = (event: DragEvent<HTMLElement>, slotIndex: number) => {
    if (!draggedTutorialId || tutorialGridLocked) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverSlotIndex(slotIndex);
  };

  const resetTutorialDragState = () => {
    setDraggedTutorialId(null);
    setDragOverSlotIndex(null);
  };

  const handleTutorialDrop = (event: DragEvent<HTMLElement>, targetSlotIndex: number) => {
    event.preventDefault();
    if (tutorialGridLocked) {
      resetTutorialDragState();
      return;
    }

    const tutorialId = event.dataTransfer.getData("text/plain") || draggedTutorialId;
    resetTutorialDragState();
    if (!tutorialId) return;

    const orderedIds = tutorials.map((tutorial) => tutorial.id);
    const sourceIndex = orderedIds.indexOf(tutorialId);
    if (sourceIndex < 0) return;

    const nextIds = orderedIds.filter((id) => id !== tutorialId);
    const insertionIndex = Math.min(Math.max(targetSlotIndex, 0), nextIds.length);
    nextIds.splice(insertionIndex, 0, tutorialId);

    void reorderTutorials(nextIds);
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
              Add, edit, activate, and drag tutorial cards to reorder every signed-in dashboard.
            </p>
          </div>
          <div className={styles.dashboardTutorialActions}>
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
            {tutorialGridSlots.map((tutorial, index) =>
              tutorial ? (
                <article
                  key={tutorial.id}
                  className={`${styles.dashboardTutorialPreviewCard} ${
                    tutorial.isActive ? "" : styles.dashboardTutorialPreviewInactive
                  } ${draggedTutorialId === tutorial.id ? styles.dashboardTutorialDragging : ""} ${
                    dragOverSlotIndex === index ? styles.dashboardTutorialDropTarget : ""
                  }`}
                  draggable={!tutorialGridLocked}
                  onDragStart={(event) => handleTutorialDragStart(event, tutorial.id)}
                  onDragEnd={resetTutorialDragState}
                  onDragOver={(event) => handleTutorialDragOver(event, index)}
                  onDrop={(event) => handleTutorialDrop(event, index)}
                >
                  <button
                    type="button"
                    className={styles.dashboardTutorialDeleteButton}
                    onClick={() => void deleteTutorial(tutorial.id)}
                    disabled={tutorialDeletingId === tutorial.id || tutorialFormLocked}
                    aria-label={`Delete ${tutorial.title}`}
                  >
                    <Trash size={14} weight="bold" aria-hidden="true" />
                  </button>
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
                </article>
              ) : (
                <div
                  key={`tutorial-slot-${index + 1}`}
                  className={`${styles.dashboardTutorialEmptySlot} ${
                    dragOverSlotIndex === index ? styles.dashboardTutorialDropTarget : ""
                  }`}
                  aria-hidden="true"
                  onDragOver={(event) => handleTutorialDragOver(event, index)}
                  onDrop={(event) => handleTutorialDrop(event, index)}
                >
                  <span>{index + 1}</span>
                </div>
              )
            )}
            {tutorials.length === 0 ? (
              <div className={styles.dashboardTutorialEmptyState}>
                <p className="eyebrow">No tutorials yet</p>
                <p className="tiny subdued">Add the first tutorial card to populate this grid.</p>
              </div>
            ) : null}
          </div>

          <div className={styles.dashboardTutorialForm}>
            <div className={styles.adminSectionHead}>
              <div>
                <p className="eyebrow">{tutorialDraft.id ? "Edit tutorial" : "Add tutorial"}</p>
                <p className="tiny subdued">
                  Add a title, YouTube destination, and thumbnail file.
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
                    {tutorialDraft.thumbnailStoragePath
                      ? "Uploaded thumbnail"
                      : "Existing thumbnail"}
                  </span>
                </div>
              ) : null}
            </div>

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
