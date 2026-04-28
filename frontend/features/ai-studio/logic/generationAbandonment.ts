import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type { StudioOutput } from "../types";

type AbandonGenerationOutputInput = {
  output: StudioOutput;
  reason?: string;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const canAbandonGenerationOutput = (output: StudioOutput | null | undefined): boolean => {
  if (!output) return false;
  return Boolean(
    normalizeString(output.sourceRef) ||
    normalizeString(output.generationId) ||
    normalizeString(output.taskId)
  );
};

export const abandonGenerationOutput = async ({
  output,
  reason = "reference_grid_clear",
}: AbandonGenerationOutputInput): Promise<void> => {
  if (!canAbandonGenerationOutput(output)) return;

  const response = await fetchWithAuth("/api/generation/abandon", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      output_id: output.id,
      source_ref: normalizeString(output.sourceRef),
      generation_id: normalizeString(output.generationId),
      request_id: normalizeString(output.taskId),
      reason,
    }),
  });

  if (!response.ok) {
    throw new Error(`Generation abandon failed with ${response.status}.`);
  }
};
