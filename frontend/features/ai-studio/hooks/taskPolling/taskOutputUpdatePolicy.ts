import type { StudioOutput } from "../../types";
import type { ShortPulseLifecycleHint } from "./providerStatusPolicy";

export const areStringArraysEqual = (left: string[] | undefined, right: string[]) => {
  if (!left) return right.length === 0;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};

export const asTrimmedString = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const resolveLifecycleTaskState = (
  lifecycleHint: ShortPulseLifecycleHint | null
): StudioOutput["taskState"] | null => {
  switch (lifecycleHint?.taskState) {
    case "pending":
    case "running":
    case "success":
    case "fail":
      return lifecycleHint.taskState;
    default:
      return null;
  }
};

export const normalizeLifecycleQueueState = (
  queueState: string | null | undefined
): StudioOutput["queueState"] => {
  switch (queueState) {
    case "queued":
      return "queued";
    case "dispatching":
      return "dispatching";
    default:
      return undefined;
  }
};
