import type { StudioOutput } from "../types";

export const MAX_CONCURRENT_GENERATIONS = 4;
export const CONCURRENT_GENERATION_CAP_MESSAGE =
  "4 max concurrent generations. Wait for one to finish before starting another.";

export const isOutputGenerationInFlight = (output: Pick<StudioOutput, "taskState">): boolean =>
  output.taskState === "pending" || output.taskState === "running";

export const countInFlightGenerations = (
  outputs: ReadonlyArray<Pick<StudioOutput, "id" | "taskState">>
): number => {
  const seenIds = new Set<string>();
  let count = 0;

  outputs.forEach((output) => {
    if (seenIds.has(output.id)) return;
    seenIds.add(output.id);
    if (isOutputGenerationInFlight(output)) {
      count += 1;
    }
  });

  return count;
};
