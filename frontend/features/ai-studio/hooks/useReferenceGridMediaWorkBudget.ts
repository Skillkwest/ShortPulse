/**
 * Unified media work-budget hook for the reference grid.
 * Shares a single token envelope between image decode hydration and video attach/autoplay work.
 */
import { useMemo } from "react";

const IMAGE_DECODE_TOKEN_COST = 1;
const VIDEO_ATTACH_TOKEN_COST = 2;

type UseReferenceGridMediaWorkBudgetParams = {
  enabled?: boolean;
  pressureLevel?: 0 | 1 | 2;
  constrainedProfile?: boolean;
  desiredImageDecodeInflight?: number;
  desiredVideoAttachSlots?: number;
};

export type ReferenceGridMediaWorkBudget = {
  totalTokens: number;
  imageDecodeTokenCost: number;
  videoAttachTokenCost: number;
  imageDecodeBudget: number;
  videoAttachBudget: number;
};

const resolveTotalTokens = ({
  pressureLevel,
  constrainedProfile,
}: {
  pressureLevel: 0 | 1 | 2;
  constrainedProfile: boolean;
}) => {
  const baseTokens = pressureLevel >= 2 ? 5 : pressureLevel >= 1 ? 6 : 8;
  if (!constrainedProfile) return baseTokens;
  return Math.max(3, Math.min(baseTokens, pressureLevel >= 1 ? 3 : 5));
};

const resolveReservedImageDecodeBudget = ({
  pressureLevel,
  totalTokens,
  desiredImageDecodeInflight,
}: {
  pressureLevel: 0 | 1 | 2;
  totalTokens: number;
  desiredImageDecodeInflight: number;
}): number => {
  if (desiredImageDecodeInflight <= 0 || pressureLevel === 0) return 0;
  const pressureImageFloor = pressureLevel >= 2 ? 3 : 2;
  return Math.min(desiredImageDecodeInflight, pressureImageFloor, totalTokens);
};

/**
 * Computes a shared work budget for image/video preview work.
 */
export const resolveReferenceGridMediaWorkBudget = ({
  enabled = true,
  pressureLevel = 0,
  constrainedProfile = false,
  desiredImageDecodeInflight = 1,
  desiredVideoAttachSlots = 0,
}: UseReferenceGridMediaWorkBudgetParams): ReferenceGridMediaWorkBudget => {
  const safeDesiredImageInflight = Math.max(0, Math.floor(desiredImageDecodeInflight));
  const safeDesiredVideoSlots = Math.max(0, Math.floor(desiredVideoAttachSlots));

  if (!enabled) {
    return {
      totalTokens: Number.MAX_SAFE_INTEGER,
      imageDecodeTokenCost: IMAGE_DECODE_TOKEN_COST,
      videoAttachTokenCost: VIDEO_ATTACH_TOKEN_COST,
      imageDecodeBudget: safeDesiredImageInflight || Number.MAX_SAFE_INTEGER,
      videoAttachBudget: safeDesiredVideoSlots,
    };
  }

  const totalTokens = resolveTotalTokens({
    pressureLevel,
    constrainedProfile,
  });
  const reservedImageDecodeBudget = resolveReservedImageDecodeBudget({
    pressureLevel,
    totalTokens,
    desiredImageDecodeInflight: safeDesiredImageInflight,
  });
  const remainingTokensAfterImageReservation = Math.max(0, totalTokens - reservedImageDecodeBudget);
  const maxVideoByTokens = Math.floor(
    remainingTokensAfterImageReservation / VIDEO_ATTACH_TOKEN_COST
  );
  let videoAttachBudget = Math.min(safeDesiredVideoSlots, maxVideoByTokens);
  let remainingTokens = Math.max(0, totalTokens - videoAttachBudget * VIDEO_ATTACH_TOKEN_COST);
  let imageDecodeBudget = Math.min(safeDesiredImageInflight, remainingTokens);

  // Keep at least one image decode lane when image work is requested.
  if (safeDesiredImageInflight > 0 && imageDecodeBudget === 0 && videoAttachBudget > 0) {
    videoAttachBudget = Math.max(0, videoAttachBudget - 1);
    remainingTokens = Math.max(0, totalTokens - videoAttachBudget * VIDEO_ATTACH_TOKEN_COST);
    imageDecodeBudget = Math.min(safeDesiredImageInflight, remainingTokens);
  }

  if (safeDesiredImageInflight > 0) {
    imageDecodeBudget = Math.max(1, imageDecodeBudget);
  }

  return {
    totalTokens,
    imageDecodeTokenCost: IMAGE_DECODE_TOKEN_COST,
    videoAttachTokenCost: VIDEO_ATTACH_TOKEN_COST,
    imageDecodeBudget,
    videoAttachBudget,
  };
};

/**
 * Returns the current shared media work budget envelope for the reference grid.
 */
export const useReferenceGridMediaWorkBudget = (
  params: UseReferenceGridMediaWorkBudgetParams
): ReferenceGridMediaWorkBudget => {
  const {
    enabled,
    pressureLevel,
    constrainedProfile,
    desiredImageDecodeInflight,
    desiredVideoAttachSlots,
  } = params;

  return useMemo(
    () =>
      resolveReferenceGridMediaWorkBudget({
        enabled,
        pressureLevel,
        constrainedProfile,
        desiredImageDecodeInflight,
        desiredVideoAttachSlots,
      }),
    [
      constrainedProfile,
      desiredImageDecodeInflight,
      desiredVideoAttachSlots,
      enabled,
      pressureLevel,
    ]
  );
};
