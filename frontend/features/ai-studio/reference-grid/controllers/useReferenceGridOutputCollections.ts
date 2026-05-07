import React from "react";
import type { StudioOutput } from "../../types";
import { useOutputSelector, useOutputsByIds } from "../../hooks/aiStudioOutputStore";
import {
  selectVisibleAllRefsProjection,
  selectQuickSlotProjection,
} from "../../reference-projections";
import { areOutputListsEqual, EMPTY_OUTPUTS } from "../referenceGridConfig";

type UseReferenceGridOutputCollectionsArgs = {
  outputsProp: StudioOutput[] | null | undefined;
  archivedOutputsProp: StudioOutput[] | null | undefined;
  curatedReferenceIds: readonly string[];
  removedFromAllRefsIds: readonly string[];
};

export type ReferenceGridOutputCollections = {
  allOutputIds: string[];
  archivedOutputs: StudioOutput[];
  curatedOutputIds: string[];
  curatedOutputs: StudioOutput[];
  outputById: Record<string, StudioOutput>;
};

export const useReferenceGridOutputCollections = ({
  outputsProp,
  archivedOutputsProp,
  curatedReferenceIds,
  removedFromAllRefsIds,
}: UseReferenceGridOutputCollectionsArgs): ReferenceGridOutputCollections => {
  const selectorOutputIds = useOutputSelector(
    React.useCallback(
      (snapshot) => {
        if (outputsProp) return [];
        return selectVisibleAllRefsProjection(
          snapshot.outputOrder
            .map((id) => snapshot.outputById[id])
            .filter((item): item is StudioOutput => Boolean(item)),
          {
            quickSlotIds: [...curatedReferenceIds],
            removedFromAllRefsIds: [...removedFromAllRefsIds],
          }
        ).map((item) => item.id);
      },
      [curatedReferenceIds, outputsProp, removedFromAllRefsIds]
    ),
    (left, right) =>
      left.length === right.length && left.every((item, index) => item === right[index])
  );
  const selectorCuratedOutputIds = useOutputSelector(
    React.useCallback(
      (snapshot) => {
        if (outputsProp) return [];
        return selectQuickSlotProjection(
          snapshot.outputOrder
            .map((id) => snapshot.outputById[id])
            .filter((item): item is StudioOutput => Boolean(item)),
          {
            quickSlotIds: [...curatedReferenceIds],
            removedFromAllRefsIds: [...removedFromAllRefsIds],
          }
        ).map((item) => item.id);
      },
      [curatedReferenceIds, outputsProp, removedFromAllRefsIds]
    ),
    (left, right) =>
      left.length === right.length && left.every((item, index) => item === right[index])
  );
  const selectorArchivedOutputs = useOutputSelector((snapshot) => {
    if (archivedOutputsProp) return EMPTY_OUTPUTS;
    return snapshot.archivedOutputOrder
      .map((id) => snapshot.archivedOutputById[id])
      .filter((item): item is StudioOutput => Boolean(item));
  }, areOutputListsEqual);
  const allOutputIds = outputsProp
    ? selectVisibleAllRefsProjection(outputsProp, {
        quickSlotIds: [...curatedReferenceIds],
        removedFromAllRefsIds: [...removedFromAllRefsIds],
      }).map((item) => item.id)
    : selectorOutputIds;
  const archivedOutputs = archivedOutputsProp ?? selectorArchivedOutputs;

  const outputById = React.useMemo(() => {
    const map: Record<string, StudioOutput> = {};
    [...(outputsProp ?? EMPTY_OUTPUTS), ...archivedOutputs].forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [archivedOutputs, outputsProp]);
  const directCuratedOutputs = React.useMemo(
    () =>
      outputsProp
        ? selectQuickSlotProjection(outputsProp, {
            quickSlotIds: [...curatedReferenceIds],
            removedFromAllRefsIds: [...removedFromAllRefsIds],
          })
        : EMPTY_OUTPUTS,
    [curatedReferenceIds, outputsProp, removedFromAllRefsIds]
  );
  const curatedOutputIds = React.useMemo(
    () => (outputsProp ? directCuratedOutputs.map((item) => item.id) : selectorCuratedOutputIds),
    [directCuratedOutputs, outputsProp, selectorCuratedOutputIds]
  );
  const selectorCuratedOutputs = useOutputsByIds(curatedOutputIds);
  const curatedOutputs = outputsProp ? directCuratedOutputs : selectorCuratedOutputs;

  return {
    allOutputIds,
    archivedOutputs,
    curatedOutputIds,
    curatedOutputs,
    outputById,
  };
};
