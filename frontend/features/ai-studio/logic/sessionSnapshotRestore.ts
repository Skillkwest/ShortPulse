import { parseAiStudioSessionSnapshotShape } from "../../../lib/ai-studio-session/sessionSnapshotShape";
import type { AiStudioSessionSnapshot } from "./sessionSnapshot";

export const parseAiStudioSessionSnapshotForRestore = (
  value: unknown,
  expectedSessionId: string | null
): AiStudioSessionSnapshot | null => {
  const record = parseAiStudioSessionSnapshotShape(value, { expectedSessionId });
  return record as AiStudioSessionSnapshot | null;
};

export const parseAiStudioSessionSnapshotV1 = parseAiStudioSessionSnapshotForRestore;
