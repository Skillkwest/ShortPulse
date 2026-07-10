/**
 * Shared Create-agent request byte policy.
 * Used by client preflight and server enforcement to prevent limit drift.
 */

export const AGENT_TEXT_REQUEST_MAX_BYTES = 512 * 1024;
export const AGENT_MIXED_REQUEST_MAX_BYTES = 1536 * 1024;
export const AGENT_INLINE_MEDIA_TARGET_TOTAL_BYTES = 900 * 1024;

export const resolveAgentRequestMaxBytes = (hasMedia: boolean): number =>
  hasMedia ? AGENT_MIXED_REQUEST_MAX_BYTES : AGENT_TEXT_REQUEST_MAX_BYTES;
