import React from "react";

import {
  clearWindowTimeoutRef,
  lockDocumentCursor,
  scheduleTransientObjectUrlRevoke as scheduleTransientObjectUrlRevokeTimer,
  unlockDocumentCursor,
  type GlobalCursorLockState,
} from "./expertEditInteractionUtils";

type UseExpertEditPanelTransientRuntimeArgs = {
  statusToastFadeMs: number;
  statusToastVisibleMs: number;
  transientObjectUrlRevokeMs: number;
  revokeObjectUrlSafe: (url: string) => void;
};

export function useExpertEditPanelTransientRuntime({
  statusToastFadeMs,
  statusToastVisibleMs,
  transientObjectUrlRevokeMs,
  revokeObjectUrlSafe,
}: UseExpertEditPanelTransientRuntimeArgs) {
  const toastVisibleTimerRef = React.useRef<number | null>(null);
  const toastFadeTimerRef = React.useRef<number | null>(null);
  const transientRevokeTimersRef = React.useRef<Map<string, number>>(new Map());
  const globalCursorLockRef = React.useRef<GlobalCursorLockState>({
    active: false,
    bodyCursor: "",
    htmlCursor: "",
  });
  const [statusToastMessage, setStatusToastMessage] = React.useState<string | null>(null);
  const [statusToastTone, setStatusToastTone] = React.useState<"info" | "warning">("info");
  const [isStatusToastFading, setIsStatusToastFading] = React.useState(false);

  const showStatusToast = React.useCallback(
    (message: string, tone: "info" | "warning" = "info") => {
      clearWindowTimeoutRef(toastVisibleTimerRef);
      clearWindowTimeoutRef(toastFadeTimerRef);
      setStatusToastMessage(message);
      setStatusToastTone(tone);
      setIsStatusToastFading(false);
      toastVisibleTimerRef.current = window.setTimeout(() => {
        setIsStatusToastFading(true);
        toastFadeTimerRef.current = window.setTimeout(() => {
          setStatusToastMessage(null);
          setIsStatusToastFading(false);
          toastFadeTimerRef.current = null;
        }, statusToastFadeMs);
        toastVisibleTimerRef.current = null;
      }, statusToastVisibleMs);
    },
    [statusToastFadeMs, statusToastVisibleMs]
  );

  const lockGlobalCursor = React.useCallback((cursor: string) => {
    lockDocumentCursor({
      cursor,
      lockState: globalCursorLockRef.current,
    });
  }, []);

  const unlockGlobalCursor = React.useCallback(() => {
    unlockDocumentCursor(globalCursorLockRef.current);
  }, []);

  const scheduleTransientObjectUrlRevoke = React.useCallback(
    (url: string) => {
      scheduleTransientObjectUrlRevokeTimer({
        url,
        timersByUrl: transientRevokeTimersRef.current,
        revokeDelayMs: transientObjectUrlRevokeMs,
        revokeObjectUrl: revokeObjectUrlSafe,
      });
    },
    [revokeObjectUrlSafe, transientObjectUrlRevokeMs]
  );

  return {
    toastVisibleTimerRef,
    toastFadeTimerRef,
    transientRevokeTimersRef,
    statusToastMessage,
    statusToastTone,
    isStatusToastFading,
    showStatusToast,
    lockGlobalCursor,
    unlockGlobalCursor,
    scheduleTransientObjectUrlRevoke,
  };
}
