/**
 * Styles-library internal reference drop resolver.
 * Returns one authoritative internal source descriptor instead of ranked URL candidates.
 */
import type { PersistOutputSaveResult } from "../../hooks/useAiStudioPersistenceActions";
import type { StudioOutput } from "../../types";
import type { InternalReferenceDragPayload } from "../../utils/dragDrop";
import {
  resolveInternalReferenceSource,
  type ResolvedInternalReferenceSource,
} from "../../logic/referenceSource/internalReferenceSource";

type OutputSnapshot = {
  outputOrder: string[];
  archivedOutputOrder: string[];
  outputById: Record<string, StudioOutput | undefined>;
  archivedOutputById: Record<string, StudioOutput | undefined>;
};

type ResolveStyleInternalDropSourceArgs = {
  payload: InternalReferenceDragPayload;
  getOutputById: (outputId: string) => StudioOutput | null;
  getOutputSnapshot: () => OutputSnapshot;
  ensureOutputPersisted: (outputId: string) => Promise<PersistOutputSaveResult>;
  resolveSavedMediaIdFromOutput: (output: StudioOutput | null, imageIndex: number) => string | null;
};

/**
 * Resolves one internal style source descriptor for downstream byte normalization.
 */
export const resolveStyleInternalDropCandidates = async ({
  payload,
  getOutputById,
  getOutputSnapshot,
  ensureOutputPersisted,
  resolveSavedMediaIdFromOutput,
}: ResolveStyleInternalDropSourceArgs): Promise<ResolvedInternalReferenceSource | null> =>
  await resolveInternalReferenceSource({
    payload,
    getOutputById,
    getOutputSnapshot,
    ensureOutputPersisted,
    resolveSavedMediaIdFromOutput,
  });

export type { ResolvedInternalReferenceSource as ResolvedInternalStyleSource };
