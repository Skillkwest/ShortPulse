import type { AiStudioSessionSnapshot } from "../logic/sessionSnapshot";

export type AiStudioWorkspaceRestoreSource = "none" | "project";

export type AiStudioPersistenceRestoreCandidateState = {
  status: "idle" | "loading" | "ready" | "error";
  result?: "idle" | "loading" | "found_snapshot" | "no_snapshot" | "load_failed";
  snapshot: AiStudioSessionSnapshot | null;
  source: AiStudioWorkspaceRestoreSource;
  error?: string | null;
  retry?: () => void;
};

export type AiStudioProjectWorkspaceFlushReason =
  | "critical_save"
  | "visibility_hidden"
  | "pagehide"
  | "project_switch"
  | "manual";

export type AiStudioProjectWorkspaceFlushResult =
  | {
      status: "saved";
      projectId: string;
      snapshotHash: string | null;
      keepalive: boolean;
    }
  | {
      status: "skipped";
      reason:
        | "not_project"
        | "not_ready"
        | "no_snapshot"
        | "serialization_failed"
        | "snapshot_too_large"
        | "unchanged";
      projectId: string | null;
      snapshotHash: string | null;
      keepalive: boolean;
    };

export type AiStudioProjectWorkspaceFlushOptions = {
  reason?: AiStudioProjectWorkspaceFlushReason;
  keepalive?: boolean;
};

export type AiStudioPersistenceController = {
  sessionId: string | null;
  sessionSnapshot: AiStudioSessionSnapshot | null;
  sessionRestoreCandidate: AiStudioPersistenceRestoreCandidateState;
  setSkipRestoreApplyForSessionId: (sessionId: string | null) => void;
  // Restore/apply has settled enough for the studio shell to open.
  projectBootstrapSettled: boolean;
  // Stricter restore-visibility proof used to unlock autosave-safe persistence work.
  projectBootstrapApplied: boolean;
  projectBootstrapError: string | null;
  retryProjectBootstrap: () => void;
  flushProjectWorkspaceSnapshot: (
    options?: AiStudioProjectWorkspaceFlushOptions
  ) => Promise<AiStudioProjectWorkspaceFlushResult>;
  resetProjectWorkspace: () => Promise<void>;
};
