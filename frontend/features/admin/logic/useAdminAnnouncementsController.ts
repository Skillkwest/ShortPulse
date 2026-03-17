/**
 * Admin announcements controller.
 * Owns announcement load, publish, clear, and form state for the admin dashboard announcements tab.
 */
import React from "react";
import type { AdminDashboardAnnouncement } from "../types";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";

export const ADMIN_DASHBOARD_ANNOUNCEMENT_TITLE_MAX_LENGTH = 120;
export const ADMIN_DASHBOARD_ANNOUNCEMENT_MESSAGE_MAX_LENGTH = 500;

const asAdminDashboardAnnouncement = (value: unknown): AdminDashboardAnnouncement | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : "";
  const title = typeof row.title === "string" ? row.title.trim() : "";
  const message = typeof row.message === "string" ? row.message.trim() : "";
  if (!id || !title || !message) return null;
  return {
    id,
    title,
    message,
    publishedAt: typeof row.publishedAt === "string" ? row.publishedAt : null,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : null,
  };
};

type UseAdminAnnouncementsControllerParams = {
  enabled: boolean;
};

type UseAdminAnnouncementsControllerResult = {
  announcementCurrent: AdminDashboardAnnouncement | null;
  announcementTitle: string;
  announcementMessage: string;
  announcementLoading: boolean;
  announcementPublishing: boolean;
  announcementClearing: boolean;
  announcementResult: string | null;
  announcementError: string | null;
  setAnnouncementTitle: React.Dispatch<React.SetStateAction<string>>;
  setAnnouncementMessage: React.Dispatch<React.SetStateAction<string>>;
  loadCurrentAnnouncement: () => Promise<void>;
  handlePublishAnnouncement: () => Promise<void>;
  handleClearAnnouncement: () => Promise<void>;
};

/**
 * Compose announcement tab state and async actions behind a route-local controller boundary.
 */
export const useAdminAnnouncementsController = ({
  enabled,
}: UseAdminAnnouncementsControllerParams): UseAdminAnnouncementsControllerResult => {
  const [announcementCurrent, setAnnouncementCurrent] =
    React.useState<AdminDashboardAnnouncement | null>(null);
  const [announcementTitle, setAnnouncementTitle] = React.useState("");
  const [announcementMessage, setAnnouncementMessage] = React.useState("");
  const [announcementLoading, setAnnouncementLoading] = React.useState(false);
  const [announcementPublishing, setAnnouncementPublishing] = React.useState(false);
  const [announcementClearing, setAnnouncementClearing] = React.useState(false);
  const [announcementResult, setAnnouncementResult] = React.useState<string | null>(null);
  const [announcementError, setAnnouncementError] = React.useState<string | null>(null);

  const loadCurrentAnnouncement = React.useCallback(async () => {
    setAnnouncementLoading(true);
    setAnnouncementError(null);
    setAnnouncementResult(null);
    try {
      const response = await fetchWithAuth("/api/admin/announcements/current", {
        method: "GET",
      });
      const data = (await response.json().catch(() => ({}))) as {
        announcement?: unknown;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Failed to load current announcement.");
      }
      const announcement = asAdminDashboardAnnouncement(data.announcement ?? null);
      setAnnouncementCurrent(announcement);
      setAnnouncementTitle(announcement?.title ?? "");
      setAnnouncementMessage(announcement?.message ?? "");
    } catch (error) {
      setAnnouncementError(
        error instanceof Error ? error.message : "Failed to load current announcement."
      );
      setAnnouncementCurrent(null);
      setAnnouncementTitle("");
      setAnnouncementMessage("");
    } finally {
      setAnnouncementLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    void loadCurrentAnnouncement();
  }, [enabled, loadCurrentAnnouncement]);

  const handlePublishAnnouncement = React.useCallback(async () => {
    const normalizedTitle = announcementTitle.trim();
    const normalizedMessage = announcementMessage.trim();
    if (!normalizedTitle) {
      setAnnouncementError("Title is required.");
      setAnnouncementResult(null);
      return;
    }
    if (!normalizedMessage) {
      setAnnouncementError("Message is required.");
      setAnnouncementResult(null);
      return;
    }
    if (normalizedTitle.length > ADMIN_DASHBOARD_ANNOUNCEMENT_TITLE_MAX_LENGTH) {
      setAnnouncementError(
        `Title must be ${ADMIN_DASHBOARD_ANNOUNCEMENT_TITLE_MAX_LENGTH} characters or fewer.`
      );
      setAnnouncementResult(null);
      return;
    }
    if (normalizedMessage.length > ADMIN_DASHBOARD_ANNOUNCEMENT_MESSAGE_MAX_LENGTH) {
      setAnnouncementError(
        `Message must be ${ADMIN_DASHBOARD_ANNOUNCEMENT_MESSAGE_MAX_LENGTH} characters or fewer.`
      );
      setAnnouncementResult(null);
      return;
    }

    setAnnouncementPublishing(true);
    setAnnouncementError(null);
    setAnnouncementResult(null);
    try {
      const response = await fetchWithAuth("/api/admin/announcements/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: normalizedTitle,
          message: normalizedMessage,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        announcement?: unknown;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Failed to publish announcement.");
      }
      const announcement = asAdminDashboardAnnouncement(data.announcement ?? null);
      if (!announcement) {
        throw new Error("Published announcement payload is invalid.");
      }
      setAnnouncementCurrent(announcement);
      setAnnouncementTitle(announcement.title);
      setAnnouncementMessage(announcement.message);
      setAnnouncementResult("Announcement published.");
    } catch (error) {
      setAnnouncementError(
        error instanceof Error ? error.message : "Failed to publish announcement."
      );
      setAnnouncementResult(null);
    } finally {
      setAnnouncementPublishing(false);
    }
  }, [announcementMessage, announcementTitle]);

  const handleClearAnnouncement = React.useCallback(async () => {
    setAnnouncementClearing(true);
    setAnnouncementError(null);
    setAnnouncementResult(null);
    try {
      const response = await fetchWithAuth("/api/admin/announcements/clear", {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || data.ok !== true) {
        throw new Error(data.error || "Failed to clear active announcement.");
      }
      setAnnouncementCurrent(null);
      setAnnouncementTitle("");
      setAnnouncementMessage("");
      setAnnouncementResult("Active announcement cleared.");
    } catch (error) {
      setAnnouncementError(
        error instanceof Error ? error.message : "Failed to clear active announcement."
      );
      setAnnouncementResult(null);
    } finally {
      setAnnouncementClearing(false);
    }
  }, []);

  return {
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
  };
};
