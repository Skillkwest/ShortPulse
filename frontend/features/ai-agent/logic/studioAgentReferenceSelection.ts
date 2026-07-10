/**
 * Selected-reference extraction helpers for the AI Studio thinker payload.
 * Ensures dragged/selected references are prioritized deterministically.
 */
import type { AgentContext, AgentReferenceSummary } from "../../../prefabs/agent";
import { AGENT_SELECTED_REFERENCE_MAX_ITEMS } from "../../../prefabs/agent/attachmentPolicy";

export type ThinkerSelectedReference = {
  id: string;
  kind: "image" | "video" | "prompt";
  promptSnippet: string | null;
  caption: string | null;
  aspect: string | null;
};

const clipText = (value?: string | null, maxLength = 320): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
};

const toSelectedReference = (reference: AgentReferenceSummary): ThinkerSelectedReference => ({
  id: reference.id,
  kind: reference.kind,
  promptSnippet: clipText(reference.promptSnippet),
  caption: clipText(reference.caption),
  aspect: reference.aspect ?? null,
});

/**
 * Picks the working reference set for thinker-stage payload construction.
 * Priority: selected ids -> focused id -> top references (modeHint=reference).
 */
export const pickSelectedReferencesForThinker = (
  context: AgentContext
): ThinkerSelectedReference[] => {
  const references = Array.isArray(context.references) ? context.references : [];
  if (!references.length) return [];

  const selectedIds = new Set(context.selectedReferenceIds ?? []);
  let prioritized = selectedIds.size
    ? references.filter((reference) => selectedIds.has(reference.id))
    : [];

  if (!prioritized.length && context.focusedReferenceId) {
    prioritized = references.filter((reference) => reference.id === context.focusedReferenceId);
  }

  if (!prioritized.length && context.modeHint === "reference") {
    prioritized = references.slice(0, 4);
  }

  return prioritized.slice(0, AGENT_SELECTED_REFERENCE_MAX_ITEMS).map(toSelectedReference);
};
