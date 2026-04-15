import React from "react";

import type { TransformHistoryEntry } from "./expertEditLayerTransformUtils";
import {
  clearTransientObjectUrlRevokeTimers,
  clearWindowTimeoutRef,
  type ObjectUrlRevokeTimers,
} from "./expertEditInteractionUtils";

type UseExpertEditStageCleanupArgs = {
  unlockGlobalCursor: () => void;
  queuePendingHistoryApplyEntry: (entry: TransformHistoryEntry | null) => void;
  clearHistoryEphemera: () => void;
  inpaintCollapseTimerRef: React.MutableRefObject<number | null>;
  toastVisibleTimerRef: React.MutableRefObject<number | null>;
  toastFadeTimerRef: React.MutableRefObject<number | null>;
  transientRevokeTimersRef: React.MutableRefObject<ObjectUrlRevokeTimers>;
  revokeObjectUrlSafe: (url: string) => void;
};

export function useExpertEditStageCleanup({
  unlockGlobalCursor,
  queuePendingHistoryApplyEntry,
  clearHistoryEphemera,
  inpaintCollapseTimerRef,
  toastVisibleTimerRef,
  toastFadeTimerRef,
  transientRevokeTimersRef,
  revokeObjectUrlSafe,
}: UseExpertEditStageCleanupArgs) {
  React.useEffect(
    () => () => {
      unlockGlobalCursor();
      queuePendingHistoryApplyEntry(null);
      clearHistoryEphemera();
      clearWindowTimeoutRef(inpaintCollapseTimerRef);
      clearWindowTimeoutRef(toastVisibleTimerRef);
      clearWindowTimeoutRef(toastFadeTimerRef);
      clearTransientObjectUrlRevokeTimers({
        timersByUrl: transientRevokeTimersRef.current,
        revokeObjectUrl: revokeObjectUrlSafe,
      });
    },
    [
      clearHistoryEphemera,
      inpaintCollapseTimerRef,
      queuePendingHistoryApplyEntry,
      revokeObjectUrlSafe,
      toastFadeTimerRef,
      toastVisibleTimerRef,
      transientRevokeTimersRef,
      unlockGlobalCursor,
    ]
  );
}
