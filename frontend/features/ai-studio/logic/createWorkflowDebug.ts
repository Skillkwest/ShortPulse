import type { AgentAttachment } from "../../../prefabs/agent";

const CREATE_WORKFLOW_DEBUG_QUERY_PARAM = "createWorkflowDebug";
const CREATE_WORKFLOW_DEBUG_STORAGE_KEY = "shortpulse.create_workflow.debug";
const MAX_CREATE_WORKFLOW_DEBUG_EVENTS = 200;

export type CreateWorkflowUrlSummary = {
  kind: "empty" | "blob" | "data" | "http" | "https" | "other";
  host: string | null;
  path: string | null;
  length: number;
};

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

export type CreateWorkflowAttachmentDiagnosis = {
  id: string;
  kind: AgentAttachment["kind"];
  deliveryStatus: AgentAttachment["deliveryStatus"] | null;
  deliveryError: string | null;
  imageUrl: CreateWorkflowUrlSummary;
  submissionImageUrl: CreateWorkflowUrlSummary;
  previewStoragePath: string | null;
  fullStoragePath: string | null;
};

export type CreateWorkflowDebugDiagnosis = {
  generatedAt: string;
  enabled: boolean;
  attachmentCount: number;
  imageAttachmentCount: number;
  eventCounts: Record<string, number>;
  attachments: CreateWorkflowAttachmentDiagnosis[];
  blockers: string[];
  likelyFailureClass:
    | "debug_disabled"
    | "no_image_attachment"
    | "delivery_failed"
    | "delivery_not_ready"
    | "missing_durable_submission_url"
    | "send_preparation_failed"
    | "send_payload_missing_image"
    | "preview_render_failed"
    | "preview_source_missing"
    | "ready_for_model_send";
};

type CreateWorkflowDebugHandle = {
  getSnapshot: () => CreateWorkflowDebugSnapshot;
  getDiagnosis: () => CreateWorkflowDebugDiagnosis;
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

export const summarizeCreateWorkflowUrl = (value: unknown): CreateWorkflowUrlSummary => {
  if (typeof value !== "string" || value.length === 0) {
    return { kind: "empty", host: null, path: null, length: 0 };
  }
  if (value.startsWith("blob:")) {
    return { kind: "blob", host: null, path: null, length: value.length };
  }
  if (value.startsWith("data:")) {
    const mediaType = value.slice(5, value.indexOf(";") > 0 ? value.indexOf(";") : 32);
    return { kind: "data", host: null, path: mediaType || null, length: value.length };
  }
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return {
        kind: url.protocol === "https:" ? "https" : "http",
        host: url.host,
        path: url.pathname,
        length: value.length,
      };
    }
  } catch {
    return { kind: "other", host: null, path: null, length: value.length };
  }
  return { kind: "other", host: null, path: null, length: value.length };
};

export const buildCreateWorkflowDiagnosis = (
  snapshot: CreateWorkflowDebugSnapshot
): CreateWorkflowDebugDiagnosis => {
  const eventCounts = snapshot.events.reduce<Record<string, number>>((counts, event) => {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
    return counts;
  }, {});
  const imageAttachments = snapshot.attachments.filter((attachment) => attachment.kind === "image");
  const attachments = snapshot.attachments.map((attachment) => ({
    id: attachment.id,
    kind: attachment.kind,
    deliveryStatus: attachment.deliveryStatus,
    deliveryError: attachment.deliveryError,
    imageUrl: summarizeCreateWorkflowUrl(attachment.imageUrl),
    submissionImageUrl: summarizeCreateWorkflowUrl(attachment.submissionImageUrl),
    previewStoragePath: attachment.previewStoragePath,
    fullStoragePath: attachment.fullStoragePath,
  }));
  const blockers: string[] = [];
  if (!snapshot.enabled) blockers.push("debug_disabled");
  if (!imageAttachments.length) blockers.push("no_image_attachment");
  if (imageAttachments.some((attachment) => attachment.deliveryStatus === "failed")) {
    blockers.push("delivery_failed");
  }
  if (
    imageAttachments.some((attachment) => {
      const status = attachment.deliveryStatus ?? "pending";
      return status === "pending" || status === "preparing";
    })
  ) {
    blockers.push("delivery_not_ready");
  }
  if (
    imageAttachments.some((attachment) => {
      const status = attachment.deliveryStatus ?? "pending";
      return (
        status === "ready" &&
        summarizeCreateWorkflowUrl(attachment.submissionImageUrl).kind !== "https"
      );
    })
  ) {
    blockers.push("missing_durable_submission_url");
  }
  if ((eventCounts.attachment_prepare_failed ?? 0) > 0) {
    blockers.push("send_preparation_failed");
  }
  const sendAttemptObserved =
    (eventCounts.attachment_send_prepare_started ?? 0) > 0 ||
    (eventCounts.attachment_prepare_failed ?? 0) > 0 ||
    (eventCounts.agent_send_payload_ready ?? 0) > 0;
  if (
    sendAttemptObserved &&
    (eventCounts.agent_send_payload_ready ?? 0) === 0 &&
    imageAttachments.length > 0
  ) {
    blockers.push("send_payload_not_observed");
  }
  if ((eventCounts.preview_img_error ?? 0) > 0) {
    blockers.push("preview_render_failed");
  }
  if ((eventCounts.preview_resolved_source_changed ?? 0) > 0) {
    const latestPreviewEvent = [...snapshot.events]
      .reverse()
      .find((event) => event.type === "preview_resolved_source_changed");
    if (latestPreviewEvent?.payload?.resolvedSrc === null) {
      blockers.push("preview_source_missing");
    }
  }

  let likelyFailureClass: CreateWorkflowDebugDiagnosis["likelyFailureClass"] =
    "ready_for_model_send";
  if (!snapshot.enabled) likelyFailureClass = "debug_disabled";
  else if (!imageAttachments.length) likelyFailureClass = "no_image_attachment";
  else if (blockers.includes("delivery_failed")) likelyFailureClass = "delivery_failed";
  else if (blockers.includes("delivery_not_ready")) likelyFailureClass = "delivery_not_ready";
  else if (blockers.includes("missing_durable_submission_url")) {
    likelyFailureClass = "missing_durable_submission_url";
  } else if (blockers.includes("send_preparation_failed")) {
    likelyFailureClass = "send_preparation_failed";
  } else if (blockers.includes("send_payload_not_observed")) {
    likelyFailureClass = "send_payload_missing_image";
  } else if (blockers.includes("preview_render_failed")) {
    likelyFailureClass = "preview_render_failed";
  } else if (blockers.includes("preview_source_missing")) {
    likelyFailureClass = "preview_source_missing";
  }

  return {
    generatedAt: new Date().toISOString(),
    enabled: snapshot.enabled,
    attachmentCount: snapshot.attachments.length,
    imageAttachmentCount: imageAttachments.length,
    eventCounts,
    attachments,
    blockers,
    likelyFailureClass,
  };
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
    getDiagnosis: () =>
      buildCreateWorkflowDiagnosis({
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
