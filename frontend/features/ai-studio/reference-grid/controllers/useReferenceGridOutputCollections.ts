import React from "react";
import type { StudioOutput } from "../../types";
import { useOutputSelector, useOutputsByIds } from "../../hooks/aiStudioOutputStore";
import {
  selectAllRefsProjectionWithLegacyFallback,
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
        if (!removedFromAllRefsIds.length) {
          return snapshot.outputOrder.filter(
            (id) => snapshot.outputById[id]?.hiddenInReferenceGrid !== true
          );
        }
        const removedIdSet = new Set(removedFromAllRefsIds);
        return snapshot.outputOrder.filter((id) => {
          const item = snapshot.outputById[id];
          if (!item) return false;
          if (removedIdSet.has(id)) return false;
          return item.hiddenInReferenceGrid !== true;
        });
      },
      [outputsProp, removedFromAllRefsIds]
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
    ? selectAllRefsProjectionWithLegacyFallback(outputsProp, {
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
  const allOutputIdSet = React.useMemo(() => new Set(allOutputIds), [allOutputIds]);
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
    () =>
      outputsProp
        ? directCuratedOutputs.map((item) => item.id)
        : curatedReferenceIds.filter((id) => allOutputIdSet.has(id)),
    [allOutputIdSet, curatedReferenceIds, directCuratedOutputs, outputsProp]
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
