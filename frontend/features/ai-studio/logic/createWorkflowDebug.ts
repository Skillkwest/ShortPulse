import type { AgentAttachment } from "../../../prefabs/agent";

const CREATE_WORKFLOW_DEBUG_QUERY_PARAM = "createWorkflowDebug";
const CREATE_WORKFLOW_DEBUG_STORAGE_KEY = "shortpulse.create_workflow.debug";
const MAX_CREATE_WORKFLOW_DEBUG_EVENTS = 200;

export type CreateWorkflowAttachmentSnapshot = {
  id: string;
  kind: AgentAttachment["kind"];
  referenceId: string | null;
  mediaId: string | null;
  imageUrl: string | null;
  submissionImageUrl: string | null;
  previewStoragePath: string | null;
  fullStoragePath: string | null;
  referenceUrl: string | null;
  referenceRenderUrl: string | null;
  imageFallbackUrls: string[];
  deliveryStatus: AgentAttachment["deliveryStatus"] | null;
  deliveryError: string | null;
};

export type CreateWorkflowDebugEvent = {
  type: string;
  at: string;
  payload: Record<string, unknown> | null;
};

export type CreateWorkflowDebugSnapshot = {
  enabled: boolean;
  attachments: CreateWorkflowAttachmentSnapshot[];
  events: CreateWorkflowDebugEvent[];
};

type CreateWorkflowDebugHandle = {
  getSnapshot: () => CreateWorkflowDebugSnapshot;
  reset: () => void;
  recordEvent: (type: string, payload?: Record<string, unknown> | null) => void;
  setAttachments: (attachments: CreateWorkflowAttachmentSnapshot[]) => void;
  setEnabled: (value: boolean) => void;
};

declare global {
  interface Window {
    __shortpulseCreateWorkflowDebug?: CreateWorkflowDebugHandle;
  }
}

const state: CreateWorkflowDebugSnapshot = {
  enabled: false,
  attachments: [],
  events: [],
};

const isDebugExplicitlyEnabled = () => {
  if (typeof window === "undefined") return false;
  try {
    const search = new URLSearchParams(window.location.search);
    if (search.get(CREATE_WORKFLOW_DEBUG_QUERY_PARAM) === "1") {
      return true;
    }
  } catch {
    // Ignore malformed location state.
  }

  try {
    return window.localStorage.getItem(CREATE_WORKFLOW_DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const syncEnabledState = () => {
  state.enabled = isDebugExplicitlyEnabled();
  return state.enabled;
};

const getOrCreateHandle = (): CreateWorkflowDebugHandle | null => {
  if (typeof window === "undefined") return null;
  if (window.__shortpulseCreateWorkflowDebug) {
    syncEnabledState();
    return window.__shortpulseCreateWorkflowDebug;
  }

  const handle: CreateWorkflowDebugHandle = {
    getSnapshot: () => ({
      enabled: state.enabled,
      attachments: [...state.attachments],
      events: [...state.events],
    }),
    reset: () => {
      state.attachments = [];
      state.events = [];
    },
    recordEvent: (type, payload = null) => {
      syncEnabledState();
      if (!state.enabled) return;
      state.events = [
        ...state.events.slice(-(MAX_CREATE_WORKFLOW_DEBUG_EVENTS - 1)),
        {
          type,
          at: new Date().toISOString(),
          payload: payload ?? null,
        },
      ];
    },
    setAttachments: (attachments) => {
      syncEnabledState();
      if (!state.enabled) return;
      state.attachments = [...attachments];
    },
    setEnabled: (value) => {
      state.enabled = value;
    },
  };

  syncEnabledState();
  window.__shortpulseCreateWorkflowDebug = handle;
  return handle;
};

export const summarizeCreateWorkflowAttachment = (
  attachment: Pick<
    AgentAttachment,
    | "id"
    | "kind"
    | "referenceId"
    | "mediaId"
    | "imageUrl"
    | "submissionImageUrl"
    | "previewStoragePath"
    | "fullStoragePath"
    | "referenceUrl"
    | "referenceRenderUrl"
    | "imageFallbackUrls"
    | "deliveryStatus"
    | "deliveryError"
  >
): CreateWorkflowAttachmentSnapshot => ({
  id: attachment.id,
  kind: attachment.kind,
  referenceId: attachment.referenceId ?? null,
  mediaId: attachment.mediaId ?? null,
  imageUrl: attachment.imageUrl ?? null,
  submissionImageUrl: attachment.submissionImageUrl ?? null,
  previewStoragePath: attachment.previewStoragePath ?? null,
  fullStoragePath: attachment.fullStoragePath ?? null,
  referenceUrl: attachment.referenceUrl ?? null,
  referenceRenderUrl: attachment.referenceRenderUrl ?? null,
  imageFallbackUrls: Array.isArray(attachment.imageFallbackUrls)
    ? [...attachment.imageFallbackUrls]
    : [],
  deliveryStatus: attachment.deliveryStatus ?? null,
  deliveryError: attachment.deliveryError ?? null,
});

export const recordCreateWorkflowEvent = (
  type: string,
  payload?: Record<string, unknown> | null
) => {
  getOrCreateHandle()?.recordEvent(type, payload ?? null);
};

export const setCreateWorkflowAttachmentSnapshot = (
  attachments: CreateWorkflowAttachmentSnapshot[]
) => {
  getOrCreateHandle()?.setAttachments(attachments);
};

export const getCreateWorkflowDebugSnapshot = (): CreateWorkflowDebugSnapshot | null =>
  getOrCreateHandle()?.getSnapshot() ?? null;
