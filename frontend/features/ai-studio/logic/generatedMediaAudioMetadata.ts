/**
 * Generated-media audio metadata helpers.
 * Keeps workflow-reload audio fields separate from the generated media authority
 * query and delivery orchestration.
 */
import type { StudioOutput } from "../types";

/**
 * Resolves persisted music lyrics from a workflow reload payload.
 */
export const resolveWorkflowReloadLyricsText = (
  workflowReload: StudioOutput["workflowReload"] | undefined
): string | null => {
  const payload = workflowReload?.payload;
  if (payload?.kind !== "music") return null;
  const lyrics = payload.lyrics?.trim();
  return lyrics || null;
};

/**
 * Resolves the audio source mode implied by a workflow reload payload.
 */
export const resolveWorkflowReloadAudioSourceMode = (
  workflowReload: StudioOutput["workflowReload"] | undefined
): StudioOutput["audioSourceMode"] => (workflowReload?.payload?.kind === "music" ? "music" : null);

/**
 * Resolves persisted music mode from a workflow reload payload.
 */
export const resolveWorkflowReloadMusicMode = (
  workflowReload: StudioOutput["workflowReload"] | undefined
): StudioOutput["musicMode"] => {
  const payload = workflowReload?.payload;
  if (payload?.kind !== "music") return null;
  return payload.mode === "instrumental" || payload.mode === "vocal" ? payload.mode : null;
};
