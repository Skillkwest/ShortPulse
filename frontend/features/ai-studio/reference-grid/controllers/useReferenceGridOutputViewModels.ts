import React from "react";
import type { StudioOutput } from "../../types";
import {
  useOutputById,
  useOutputMapByIds,
  useOutputSelector,
  useOutputsByIds,
} from "../../hooks/aiStudioOutputStore";
import {
  areReferenceGridMediaOutputEntriesEqual,
  areReferenceGridMediaOutputsEqual,
  projectReferenceGridMediaOutput,
  type ReferenceGridMediaOutput,
} from "../logic/referenceGridMediaOutput";

type UseReferenceGridOutputViewModelsArgs = {
  outputsProp: StudioOutput[] | null | undefined;
  outputById: Record<string, StudioOutput>;
  activeOutputId: string | null;
  visibleOutputIds: readonly string[];
  visibleCuratedOutputIds: readonly string[];
  nearViewportOutputIds: readonly string[];
  nearViewportCuratedOutputIds: readonly string[];
};

export type ReferenceGridOutputViewModels = {
  activeOutput: StudioOutput | null;
  visibleOutputs: StudioOutput[];
  visibleCuratedOutputs: StudioOutput[];
  nearViewportOutputs: StudioOutput[];
  nearViewportCuratedOutputs: StudioOutput[];
  visibleMediaOutputs: ReferenceGridMediaOutput[];
  visibleCuratedMediaOutputs: ReferenceGridMediaOutput[];
  nearViewportMediaOutputs: ReferenceGridMediaOutput[];
  nearViewportCuratedMediaOutputs: ReferenceGridMediaOutput[];
  activeMediaOutput: ReferenceGridMediaOutput | null;
  visibleOutputById: Record<string, StudioOutput>;
};

export const useReferenceGridOutputViewModels = ({
  outputsProp,
  outputById,
  activeOutputId,
  visibleOutputIds,
  visibleCuratedOutputIds,
  nearViewportOutputIds,
  nearViewportCuratedOutputIds,
}: UseReferenceGridOutputViewModelsArgs): ReferenceGridOutputViewModels => {
  const selectorVisibleOutputs = useOutputsByIds(visibleOutputIds);
  const selectorVisibleCuratedOutputs = useOutputsByIds(visibleCuratedOutputIds);
  const selectorNearViewportOutputs = useOutputsByIds(nearViewportOutputIds);
  const selectorNearViewportCuratedOutputs = useOutputsByIds(nearViewportCuratedOutputIds);
  const selectorVisibleOutputById = useOutputMapByIds([
    ...visibleCuratedOutputIds,
    ...visibleOutputIds,
  ]);
  const selectorVisibleMediaOutputs = useOutputSelector(
    React.useCallback(
      (snapshot) =>
        visibleOutputIds
          .map((id) => snapshot.outputById[id])
          .filter((item): item is StudioOutput => Boolean(item))
          .map(projectReferenceGridMediaOutput),
      [visibleOutputIds]
    ),
    areReferenceGridMediaOutputsEqual
  );
  const selectorVisibleCuratedMediaOutputs = useOutputSelector(
    React.useCallback(
      (snapshot) =>
        visibleCuratedOutputIds
          .map((id) => snapshot.outputById[id])
          .filter((item): item is StudioOutput => Boolean(item))
          .map(projectReferenceGridMediaOutput),
      [visibleCuratedOutputIds]
    ),
    areReferenceGridMediaOutputsEqual
  );
  const selectorNearViewportMediaOutputs = useOutputSelector(
    React.useCallback(
      (snapshot) =>
        nearViewportOutputIds
          .map((id) => snapshot.outputById[id])
          .filter((item): item is StudioOutput => Boolean(item))
          .map(projectReferenceGridMediaOutput),
      [nearViewportOutputIds]
    ),
    areReferenceGridMediaOutputsEqual
  );
  const selectorNearViewportCuratedMediaOutputs = useOutputSelector(
    React.useCallback(
      (snapshot) =>
        nearViewportCuratedOutputIds
          .map((id) => snapshot.outputById[id])
          .filter((item): item is StudioOutput => Boolean(item))
          .map(projectReferenceGridMediaOutput),
      [nearViewportCuratedOutputIds]
    ),
    areReferenceGridMediaOutputsEqual
  );
  const selectorActiveMediaOutput = useOutputSelector(
    React.useCallback(
      (snapshot) => {
        if (!activeOutputId) return null;
        const item =
          snapshot.outputById[activeOutputId] ?? snapshot.archivedOutputById[activeOutputId];
        return item ? projectReferenceGridMediaOutput(item) : null;
      },
      [activeOutputId]
    ),
    areReferenceGridMediaOutputEntriesEqual
  );
  const selectorActiveOutput = useOutputById(activeOutputId);

  const activeOutput =
    outputsProp != null && activeOutputId
      ? (outputById[activeOutputId] ?? null)
      : selectorActiveOutput;
  const visibleOutputs =
    outputsProp != null
      ? visibleOutputIds
          .map((id) => outputById[id])
          .filter((item): item is StudioOutput => Boolean(item))
      : selectorVisibleOutputs;
  const visibleCuratedOutputs =
    outputsProp != null
      ? visibleCuratedOutputIds
          .map((id) => outputById[id])
          .filter((item): item is StudioOutput => Boolean(item))
      : selectorVisibleCuratedOutputs;
  const nearViewportOutputs =
    outputsProp != null
      ? nearViewportOutputIds
          .map((id) => outputById[id])
          .filter((item): item is StudioOutput => Boolean(item))
      : selectorNearViewportOutputs;
  const nearViewportCuratedOutputs =
    outputsProp != null
      ? nearViewportCuratedOutputIds
          .map((id) => outputById[id])
          .filter((item): item is StudioOutput => Boolean(item))
      : selectorNearViewportCuratedOutputs;
  const visibleMediaOutputs =
    outputsProp != null
      ? visibleOutputs.map(projectReferenceGridMediaOutput)
      : selectorVisibleMediaOutputs;
  const visibleCuratedMediaOutputs =
    outputsProp != null
      ? visibleCuratedOutputs.map(projectReferenceGridMediaOutput)
      : selectorVisibleCuratedMediaOutputs;
  const nearViewportMediaOutputs =
    outputsProp != null
      ? nearViewportOutputs.map(projectReferenceGridMediaOutput)
      : selectorNearViewportMediaOutputs;
  const nearViewportCuratedMediaOutputs =
    outputsProp != null
      ? nearViewportCuratedOutputs.map(projectReferenceGridMediaOutput)
      : selectorNearViewportCuratedMediaOutputs;
  const activeMediaOutput =
    outputsProp != null && activeOutput
      ? projectReferenceGridMediaOutput(activeOutput)
      : selectorActiveMediaOutput;

  const visibleOutputById = React.useMemo(() => {
    if (outputsProp == null) return selectorVisibleOutputById;
    const map: Record<string, StudioOutput> = {};
    [...visibleCuratedOutputs, ...visibleOutputs].forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [outputsProp, selectorVisibleOutputById, visibleCuratedOutputs, visibleOutputs]);

  return {
    activeOutput,
    visibleOutputs,
    visibleCuratedOutputs,
    nearViewportOutputs,
    nearViewportCuratedOutputs,
    visibleMediaOutputs,
    visibleCuratedMediaOutputs,
    nearViewportMediaOutputs,
    nearViewportCuratedMediaOutputs,
    activeMediaOutput,
    visibleOutputById,
  };
};
