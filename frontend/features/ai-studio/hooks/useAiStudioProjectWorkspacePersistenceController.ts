/**
 * AI Studio project-workspace persistence controller.
 * Orchestrates project-owned restore/apply and debounced autosave against project workspace authority.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import {
  createAiStudioProjectWorkspaceSnapshot,
  createAiStudioProjectWorkspaceAutosaveCandidates,
  type AiStudioProjectWorkspaceAutosaveCandidateKind,
  type AiStudioSessionSnapshot,
} from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import {
  resetAiStudioProjectWorkspaceSnapshotViaApi,
  saveAiStudioProjectWorkspaceSnapshotViaApi,
} from "../logic/projectWorkspaceApiClient";
import {
  useAiStudioSessionAutosave,
  type AiStudioSessionAutosaveError,
} from "./useAiStudioSessionAutosave";
import { useAiStudioProjectWorkspaceRestoreCandidate } from "./useAiStudioProjectWorkspaceRestoreCandidate";
import { useAiStudioProjectWorkspaceRestoreHydration } from "./useAiStudioProjectWorkspaceRestoreHydration";
import { resetAiStudioOutputStore } from "./aiStudioOutputStore";
import {
  AI_STUDIO_SESSION_MAX_SNAPSHOT_BYTES,
  type AiStudioSessionCanvasState,
} from "../logic/sessionSnapshotCanvas";
import type { AiStudioPersistenceController } from "./aiStudioPersistenceControllerContract";

type UseAiStudioProjectWorkspacePersistenceControllerParams = {
  projectId: string | null;
  projectRouteRequested?: boolean;
  sessionId: string | null;
  buildBaseSessionSnapshot: (sessionId: string) => AiStudioSessionSnapshot;
  patchSessionSnapshot?: (snapshot: AiStudioSessionSnapshot) => AiStudioSessionSnapshot;
  hydrateFromSessionSnapshot: (
    snapshot: AiStudioSessionSnapshot
  ) => AiStudioSessionHydrationPayload;
  hydrateFromSessionCanvasSnapshot?: (canvas: AiStudioSessionCanvasState | null) => void;
  hydrateFromSessionExpertEditSnapshot?: (
    expertEdit: AiStudioSessionHydrationPayload["expertEdit"]
  ) => void;
  applyEmptyProjectState?: () => void;
  resetProjectAgentConversation?: () => void;
  onPersistenceWarning?: (message: string) => void;
};

const resolveProjectPersistenceWarningMessage = ({
  reason,
  snapshotBytes,
  maxSnapshotBytes,
  error,
}: {
  reason: "snapshot_too_large" | "snapshot_serialize_failed" | "persist_failed";
  snapshotBytes?: number;
  maxSnapshotBytes: number;
  error: Error;
}): string => {
  switch (reason) {
    case "snapshot_too_large": {
      const currentKb = typeof snapshotBytes === "number" ? Math.ceil(snapshotBytes / 1024) : null;
      const limitKb = Math.ceil(maxSnapshotBytes / 1024);
      if (currentKb == null) {
        return `Project autosave skipped because workspace size exceeded the ${limitKb}KB limit.`;
      }
      return `Project autosave skipped because workspace size (${currentKb}KB) exceeded the ${limitKb}KB limit.`;
    }
    case "snapshot_serialize_failed":
      return "Project autosave skipped because workspace serialization failed.";
    case "persist_failed":
    default:
      return `Project autosave is retrying in the background: ${error.message}`;
  }
};

const utf8ByteLength = (value: string): number => {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).byteLength;
  }
  return value.length;
};

const collectProjectSnapshotOutputIds = (snapshot: AiStudioSessionSnapshot): string[] => {
  const seen = new Set<string>();
  const collected: string[] = [];
  const rows = [
    ...(Array.isArray(snapshot.outputs?.active) ? snapshot.outputs.active : []),
    ...(Array.isArray(snapshot.outputs?.archived) ? snapshot.outputs.archived : []),
  ];
  rows.forEach((row) => {
    const outputId = typeof row?.id === "string" ? row.id.trim() : "";
    if (!outputId || seen.has(outputId)) return;
    seen.add(outputId);
    collected.push(outputId);
  });
  return collected;
};

const areStringListsEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const resolveReducedWorkspaceNotice = (
  fallbackKind: Exclude<AiStudioProjectWorkspaceAutosaveCandidateKind, "full">
): string => {
  if (fallbackKind.includes("archived_outputs")) {
    return "Project autosave saved a reduced workspace snapshot to stay within size limits. Archived outputs may not fully restore.";
  }
  if (fallbackKind.includes("expert_edit") || fallbackKind.includes("canvas")) {
    return "Project autosave saved a reduced workspace snapshot to stay within size limits. Canvas layout or edit overlays may need to be rebuilt.";
  }
  return "Project autosave saved a reduced workspace snapshot to stay within size limits.";
};

const resolveProjectRepairPendingNotice = (): string =>
  "Project autosave saved the workspace, but project asset repair is pending. Recent outputs may not fully restore until the next successful save.";

/**
 * Returns project-owned persistence wiring for AI Studio page orchestration.
 */
export const useAiStudioProjectWorkspacePersistenceController = ({
  projectId,
  projectRouteRequested = false,
  sessionId,
  buildBaseSessionSnapshot,
  patchSessionSnapshot,
  hydrateFromSessionSnapshot,
  hydrateFromSessionCanvasSnapshot,
  hydrateFromSessionExpertEditSnapshot,
  applyEmptyProjectState,
  resetProjectAgentConversation,
  onPersistenceWarning,
}: UseAiStudioProjectWorkspacePersistenceControllerParams): AiStudioPersistenceController => {
  const [bootstrappedProject, setBootstrappedProject] = useState<{
    projectId: string;
    revision: number;
  } | null>(null);
  const [bootstrapError, setBootstrapError] = useState<{
    projectId: string;
    revision: number;
    message: string;
  } | null>(null);
  const projectRuntimeAuthority = projectRouteRequested
    ? projectId
      ? `project:${projectId}`
      : "project:pending"
    : null;
  const [runtimeAuthorityState, setRuntimeAuthorityState] = useState<{
    authority: string | null;
    revision: number;
  }>(() => ({
    authority: projectRuntimeAuthority,
    revision: 0,
  }));
  const projectRuntimeRevision =
    runtimeAuthorityState.authority === projectRuntimeAuthority
      ? runtimeAuthorityState.revision
      : runtimeAuthorityState.revision + 1;
  if (runtimeAuthorityState.authority !== projectRuntimeAuthority) {
    setRuntimeAuthorityState({
      authority: projectRuntimeAuthority,
      revision: projectRuntimeRevision,
    });
  }
  const invalidatedRevisionRef = useRef<number | null>(null);
  const sessionRestoreCandidate = useAiStudioProjectWorkspaceRestoreCandidate({
    projectId,
    enabled: Boolean(projectId),
  });
  const projectBootstrapReady =
    Boolean(projectId) &&
    sessionRestoreCandidate.status === "ready" &&
    bootstrappedProject?.projectId === projectId &&
    bootstrappedProject.revision === projectRuntimeRevision;
  const baseSessionSnapshot = useMemo(
    () =>
      sessionId && projectBootstrapReady
        ? createAiStudioProjectWorkspaceSnapshot(buildBaseSessionSnapshot(sessionId))
        : null,
    [buildBaseSessionSnapshot, projectBootstrapReady, sessionId]
  );
  const sessionSnapshot = useMemo(
    () =>
      baseSessionSnapshot && patchSessionSnapshot
        ? patchSessionSnapshot(baseSessionSnapshot)
        : baseSessionSnapshot,
    [baseSessionSnapshot, patchSessionSnapshot]
  );
  const reducedSnapshotNoticeKeyRef = useRef<string | null>(null);
  const repairPendingNoticeKeyRef = useRef<string | null>(null);
  const autosaveSnapshotSelection = (() => {
    if (!sessionSnapshot) {
      return {
        snapshot: null as AiStudioSessionSnapshot | null,
        fallbackKind: "full" as AiStudioProjectWorkspaceAutosaveCandidateKind,
      };
    }
    for (const candidate of createAiStudioProjectWorkspaceAutosaveCandidates(sessionSnapshot)) {
      try {
        const bytes = utf8ByteLength(JSON.stringify(candidate.snapshot));
        if (bytes <= AI_STUDIO_SESSION_MAX_SNAPSHOT_BYTES) {
          return {
            snapshot: candidate.snapshot,
            fallbackKind: candidate.kind,
          };
        }
      } catch {
        // try the next candidate
      }
    }
    return {
      snapshot: sessionSnapshot,
      fallbackKind: "full" as AiStudioProjectWorkspaceAutosaveCandidateKind,
    };
  })();

  useEffect(() => {
    if (!projectRuntimeAuthority) {
      invalidatedRevisionRef.current = null;
      return;
    }
    if (invalidatedRevisionRef.current === projectRuntimeRevision) return;
    invalidatedRevisionRef.current = projectRuntimeRevision;
    // Fail closed for decoupled selector-store surfaces before async restore finishes.
    resetAiStudioOutputStore();
    applyEmptyProjectState?.();
  }, [applyEmptyProjectState, projectRuntimeAuthority, projectRuntimeRevision]);

  useEffect(() => {
    if (!projectId || autosaveSnapshotSelection.fallbackKind === "full") return;
    const noticeKey = [
      projectId,
      sessionSnapshot?.updatedAt ?? "none",
      autosaveSnapshotSelection.fallbackKind,
    ].join("|");
    if (reducedSnapshotNoticeKeyRef.current === noticeKey) return;
    reducedSnapshotNoticeKeyRef.current = noticeKey;
    onPersistenceWarning?.(
      resolveReducedWorkspaceNotice(
        autosaveSnapshotSelection.fallbackKind as Exclude<
          AiStudioProjectWorkspaceAutosaveCandidateKind,
          "full"
        >
      )
    );
  }, [
    autosaveSnapshotSelection.fallbackKind,
    onPersistenceWarning,
    projectId,
    sessionSnapshot?.updatedAt,
  ]);

  const handleProjectBootstrapSettled = useCallback(
    (activeProjectId: string) => {
      addBreadcrumb({
        type: "ui",
        level: "info",
        message: "ai_studio_project_workspace_bootstrap_settled",
        data: {
          project_id: activeProjectId,
          runtime_revision: projectRuntimeRevision,
        },
      });
      setBootstrappedProject({
        projectId: activeProjectId,
        revision: projectRuntimeRevision,
      });
    },
    [projectRuntimeRevision]
  );

  const handleProjectBootstrapFailed = useCallback(
    (activeProjectId: string, error: Error) => {
      const message = error.message || "Failed to apply project workspace.";
      addBreadcrumb({
        type: "ui",
        level: "warn",
        message: "ai_studio_project_workspace_bootstrap_failed",
        data: {
          project_id: activeProjectId,
          runtime_revision: projectRuntimeRevision,
          error: message,
        },
      });
      setBootstrapError((current) => {
        if (
          current?.projectId === activeProjectId &&
          current.revision === projectRuntimeRevision &&
          current.message === message
        ) {
          return current;
        }
        return {
          projectId: activeProjectId,
          revision: projectRuntimeRevision,
          message,
        };
      });
    },
    [projectRuntimeRevision]
  );

  useAiStudioProjectWorkspaceRestoreHydration({
    projectId,
    projectWorkspaceRestoreCandidate: sessionRestoreCandidate,
    hydrateFromSessionSnapshot,
    hydrateFromSessionCanvasSnapshot,
    hydrateFromSessionExpertEditSnapshot,
    applyEmptyProjectState,
    resetProjectAgentConversation,
    onProjectBootstrapSettled: handleProjectBootstrapSettled,
    onProjectBootstrapFailed: handleProjectBootstrapFailed,
  });

  const persistProjectWorkspaceSnapshot = useCallback(
    async (
      activeProjectId: string,
      snapshot: AiStudioSessionSnapshot,
      options?: { keepalive?: boolean }
    ) => {
      const savedWorkspace = await saveAiStudioProjectWorkspaceSnapshotViaApi({
        projectId: activeProjectId,
        snapshot,
        keepalive: options?.keepalive,
      });
      const localOutputIds = collectProjectSnapshotOutputIds(snapshot);
      const savedSnapshot =
        savedWorkspace.snapshot && typeof savedWorkspace.snapshot === "object"
          ? (savedWorkspace.snapshot as AiStudioSessionSnapshot)
          : null;
      const savedOutputIds = savedSnapshot ? collectProjectSnapshotOutputIds(savedSnapshot) : [];
      if (savedSnapshot && !areStringListsEqual(localOutputIds, savedOutputIds)) {
        addBreadcrumb({
          type: "ui",
          level: "info",
          message: "ai_studio_project_workspace_save_canonicalized",
          data: {
            project_id: activeProjectId,
            local_output_count: localOutputIds.length,
            saved_output_count: savedOutputIds.length,
            local_output_ids: localOutputIds,
            saved_output_ids: savedOutputIds,
            keepalive: options?.keepalive === true,
          },
        });
      }
      if (savedWorkspace.saveOutcome?.status === "saved_with_repair_pending") {
        const noticeKey = [
          activeProjectId,
          snapshot.updatedAt,
          savedWorkspace.saveOutcome.repairStage ?? "repair_pending",
          savedWorkspace.saveOutcome.repairMessage ?? "",
        ].join("|");
        if (repairPendingNoticeKeyRef.current !== noticeKey) {
          repairPendingNoticeKeyRef.current = noticeKey;
          onPersistenceWarning?.(resolveProjectRepairPendingNotice());
        }
      }
    },
    [onPersistenceWarning]
  );

  const writeProjectWorkspaceSnapshot = useCallback(
    (
      activeProjectId: string,
      snapshot: AiStudioSessionSnapshot,
      options?: { keepalive?: boolean }
    ) =>
      persistProjectWorkspaceSnapshot(activeProjectId, snapshot, {
        keepalive: options?.keepalive,
      }),
    [persistProjectWorkspaceSnapshot]
  );

  const resolveProjectSnapshotTitle = useCallback(() => null, []);

  const handleProjectPersistError = useCallback(
    (error: Error, details: AiStudioSessionAutosaveError) => {
      onPersistenceWarning?.(
        resolveProjectPersistenceWarningMessage({
          reason: details.reason,
          snapshotBytes: details.snapshotBytes,
          maxSnapshotBytes: details.maxSnapshotBytes,
          error,
        })
      );
    },
    [onPersistenceWarning]
  );
  const activeBootstrapError =
    bootstrapError?.projectId === projectId && bootstrapError.revision === projectRuntimeRevision
      ? bootstrapError
      : null;

  useAiStudioSessionAutosave({
    sessionId: projectId,
    snapshot: autosaveSnapshotSelection.snapshot,
    enabled: projectBootstrapReady && !activeBootstrapError,
    persistSnapshot: writeProjectWorkspaceSnapshot,
    resolveSnapshotTitle: resolveProjectSnapshotTitle,
    onPersistError: handleProjectPersistError,
  });

  const retryProjectBootstrap = useCallback(() => {
    if (projectId) {
      setBootstrapError((current) =>
        current?.projectId === projectId && current.revision === projectRuntimeRevision
          ? null
          : current
      );
    }
    sessionRestoreCandidate.retry();
  }, [projectId, projectRuntimeRevision, sessionRestoreCandidate]);

  const resetProjectWorkspace = useCallback(async () => {
    if (!projectId) return;
    await resetAiStudioProjectWorkspaceSnapshotViaApi({ projectId });
    setBootstrapError((current) =>
      current?.projectId === projectId && current.revision === projectRuntimeRevision
        ? null
        : current
    );
    sessionRestoreCandidate.retry();
  }, [projectId, projectRuntimeRevision, sessionRestoreCandidate]);

  return {
    sessionId,
    sessionSnapshot,
    sessionRestoreCandidate,
    setSkipRestoreApplyForSessionId: () => undefined,
    projectBootstrapApplied: projectBootstrapReady,
    projectBootstrapError:
      activeBootstrapError?.message ??
      (sessionRestoreCandidate.status === "error" ? sessionRestoreCandidate.error : null),
    retryProjectBootstrap,
    resetProjectWorkspace,
  };
};
