/**
 * Admin dashboard tutorials controller.
 * Owns tutorial catalog loading, draft state, save/delete, and reorder actions.
 */
import React from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type { AdminDashboardTutorial } from "../types";

export const ADMIN_DASHBOARD_TUTORIAL_TITLE_MAX_LENGTH = 120;
export const ADMIN_DASHBOARD_TUTORIAL_THUMBNAIL_ALT_MAX_LENGTH = 160;

export type AdminDashboardTutorialDraft = {
  id: string | null;
  title: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  thumbnailMediaType: "image" | "video";
  thumbnailAlt: string;
  displayOrder: string;
  isActive: boolean;
};

type UseAdminDashboardTutorialsControllerParams = {
  enabled: boolean;
};

type UseAdminDashboardTutorialsControllerResult = {
  tutorials: AdminDashboardTutorial[];
  draft: AdminDashboardTutorialDraft;
  loading: boolean;
  saving: boolean;
  deletingId: string | null;
  reorderingId: string | null;
  result: string | null;
  error: string | null;
  updateDraft: (patch: Partial<AdminDashboardTutorialDraft>) => void;
  startNewTutorial: () => void;
  editTutorial: (tutorial: AdminDashboardTutorial) => void;
  loadTutorials: () => Promise<void>;
  saveDraft: () => Promise<void>;
  deleteTutorial: (tutorialId: string) => Promise<void>;
  moveTutorial: (tutorialId: string, direction: "up" | "down") => Promise<void>;
};

const emptyDraft = (displayOrder = 1): AdminDashboardTutorialDraft => ({
  id: null,
  title: "",
  youtubeUrl: "",
  thumbnailUrl: "",
  thumbnailMediaType: "image",
  thumbnailAlt: "",
  displayOrder: String(displayOrder),
  isActive: true,
});

const asAdminDashboardTutorial = (value: unknown): AdminDashboardTutorial | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : "";
  const title = typeof row.title === "string" ? row.title.trim() : "";
  const youtubeUrl = typeof row.youtubeUrl === "string" ? row.youtubeUrl.trim() : "";
  const thumbnailUrl = typeof row.thumbnailUrl === "string" ? row.thumbnailUrl.trim() : "";
  const thumbnailMediaType =
    row.thumbnailMediaType === "video" || row.thumbnailMediaType === "image"
      ? row.thumbnailMediaType
      : "image";
  if (!id || !title || !youtubeUrl || !thumbnailUrl) return null;
  return {
    id,
    title,
    youtubeUrl,
    thumbnailUrl,
    thumbnailMediaType,
    thumbnailAlt: typeof row.thumbnailAlt === "string" ? row.thumbnailAlt.trim() : "",
    displayOrder: typeof row.displayOrder === "number" ? row.displayOrder : 0,
    isActive: row.isActive === true,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : null,
  };
};

const draftFromTutorial = (tutorial: AdminDashboardTutorial): AdminDashboardTutorialDraft => ({
  id: tutorial.id,
  title: tutorial.title,
  youtubeUrl: tutorial.youtubeUrl,
  thumbnailUrl: tutorial.thumbnailUrl,
  thumbnailMediaType: tutorial.thumbnailMediaType,
  thumbnailAlt: tutorial.thumbnailAlt,
  displayOrder: String(tutorial.displayOrder),
  isActive: tutorial.isActive,
});

const sortTutorials = (tutorials: AdminDashboardTutorial[]): AdminDashboardTutorial[] =>
  [...tutorials].sort((a, b) => a.displayOrder - b.displayOrder || a.title.localeCompare(b.title));

/**
 * Composes dashboard tutorial admin catalog state and persistence actions.
 */
export const useAdminDashboardTutorialsController = ({
  enabled,
}: UseAdminDashboardTutorialsControllerParams): UseAdminDashboardTutorialsControllerResult => {
  const [tutorials, setTutorials] = React.useState<AdminDashboardTutorial[]>([]);
  const [draft, setDraft] = React.useState<AdminDashboardTutorialDraft>(() => emptyDraft());
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [reorderingId, setReorderingId] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const replaceTutorials = React.useCallback((nextTutorials: AdminDashboardTutorial[]) => {
    setTutorials(sortTutorials(nextTutorials));
  }, []);

  const loadTutorials = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetchWithAuth("/api/admin/dashboard/tutorials", {
        method: "GET",
      });
      const data = (await response.json().catch(() => ({}))) as {
        tutorials?: unknown[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Failed to load dashboard tutorials.");
      }
      const nextTutorials = (Array.isArray(data.tutorials) ? data.tutorials : [])
        .map(asAdminDashboardTutorial)
        .filter((tutorial): tutorial is AdminDashboardTutorial => tutorial !== null);
      replaceTutorials(nextTutorials);
      setDraft((currentDraft) =>
        currentDraft.id ? currentDraft : emptyDraft(nextTutorials.length + 1)
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Failed to load dashboard tutorials."
      );
      replaceTutorials([]);
      setDraft(emptyDraft());
    } finally {
      setLoading(false);
    }
  }, [replaceTutorials]);

  React.useEffect(() => {
    if (!enabled) return;
    void loadTutorials();
  }, [enabled, loadTutorials]);

  const updateDraft = React.useCallback((patch: Partial<AdminDashboardTutorialDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
    setResult(null);
  }, []);

  const startNewTutorial = React.useCallback(() => {
    setDraft(emptyDraft(tutorials.length + 1));
    setError(null);
    setResult(null);
  }, [tutorials.length]);

  const editTutorial = React.useCallback((tutorial: AdminDashboardTutorial) => {
    setDraft(draftFromTutorial(tutorial));
    setError(null);
    setResult(null);
  }, []);

  const saveDraft = React.useCallback(async () => {
    const title = draft.title.trim();
    const youtubeUrl = draft.youtubeUrl.trim();
    const thumbnailUrl = draft.thumbnailUrl.trim();
    const thumbnailAlt = draft.thumbnailAlt.trim();
    const displayOrderRaw = Number(draft.displayOrder);
    const displayOrder = Number.isFinite(displayOrderRaw)
      ? Math.max(0, Math.trunc(displayOrderRaw))
      : tutorials.length + 1;

    if (!title) {
      setError("Tutorial title is required.");
      setResult(null);
      return;
    }
    if (!youtubeUrl) {
      setError("YouTube URL is required.");
      setResult(null);
      return;
    }
    if (!thumbnailUrl) {
      setError("Thumbnail URL is required.");
      setResult(null);
      return;
    }

    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetchWithAuth("/api/admin/dashboard/tutorials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          title,
          youtubeUrl,
          thumbnailUrl,
          thumbnailAlt,
          displayOrder,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        tutorial?: unknown;
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Failed to save dashboard tutorial.");
      }
      const savedTutorial = asAdminDashboardTutorial(data.tutorial ?? null);
      if (!savedTutorial) {
        throw new Error("Saved tutorial payload is invalid.");
      }
      await loadTutorials();
      setDraft(draftFromTutorial(savedTutorial));
      setResult(data.message ?? "Tutorial saved.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Failed to save dashboard tutorial."
      );
      setResult(null);
    } finally {
      setSaving(false);
    }
  }, [draft, loadTutorials, tutorials.length]);

  const deleteTutorial = React.useCallback(
    async (tutorialId: string) => {
      setDeletingId(tutorialId);
      setError(null);
      setResult(null);
      try {
        const response = await fetchWithAuth("/api/admin/dashboard/tutorials", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: tutorialId }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error || "Failed to delete tutorial.");
        }
        await loadTutorials();
        setDraft(emptyDraft(Math.max(1, tutorials.length)));
        setResult(data.message ?? "Tutorial deleted.");
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Failed to delete tutorial.");
        setResult(null);
      } finally {
        setDeletingId(null);
      }
    },
    [loadTutorials, tutorials.length]
  );

  const moveTutorial = React.useCallback(
    async (tutorialId: string, direction: "up" | "down") => {
      const orderedTutorials = sortTutorials(tutorials);
      const currentIndex = orderedTutorials.findIndex((tutorial) => tutorial.id === tutorialId);
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedTutorials.length) return;

      const nextTutorials = [...orderedTutorials];
      [nextTutorials[currentIndex], nextTutorials[targetIndex]] = [
        nextTutorials[targetIndex],
        nextTutorials[currentIndex],
      ];

      setReorderingId(tutorialId);
      setError(null);
      setResult(null);
      try {
        const response = await fetchWithAuth("/api/admin/dashboard/tutorials", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: nextTutorials.map((tutorial) => tutorial.id) }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          tutorials?: unknown[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error || "Failed to reorder tutorials.");
        }
        const savedTutorials = (Array.isArray(data.tutorials) ? data.tutorials : [])
          .map(asAdminDashboardTutorial)
          .filter((tutorial): tutorial is AdminDashboardTutorial => tutorial !== null);
        replaceTutorials(savedTutorials);
        setResult("Tutorial order updated.");
      } catch (caughtError) {
        setError(
          caughtError instanceof Error ? caughtError.message : "Failed to reorder tutorials."
        );
        setResult(null);
      } finally {
        setReorderingId(null);
      }
    },
    [replaceTutorials, tutorials]
  );

  return {
    tutorials,
    draft,
    loading,
    saving,
    deletingId,
    reorderingId,
    result,
    error,
    updateDraft,
    startNewTutorial,
    editTutorial,
    loadTutorials,
    saveDraft,
    deleteTutorial,
    moveTutorial,
  };
};
