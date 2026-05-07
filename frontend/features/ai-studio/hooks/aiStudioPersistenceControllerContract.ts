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

export type AiStudioPersistenceController = {
  sessionId: string | null;
  sessionSnapshot: AiStudioSessionSnapshot | null;
  sessionRestoreCandidate: AiStudioPersistenceRestoreCandidateState;
  setSkipRestoreApplyForSessionId: (sessionId: string | null) => void;
  projectBootstrapApplied: boolean;
  projectBootstrapError: string | null;
  retryProjectBootstrap: () => void;
};
