import React from "react";

import { isSpaceActivationKey } from "./expertEditPanelViewContract";
import {
  isKeyboardEventFromEditableTarget,
  isKeyboardEventFromInteractiveTarget,
} from "./expertEditInteractionUtils";

type UseExpertEditStageKeyboardBindingsArgs = {
  panelRootRef: React.RefObject<HTMLElement | null>;
  isMarkupExpandSelected: boolean;
  isMorePresetsSurfaceOpen: boolean;
  setIsMarkupPanSpacePressed: React.Dispatch<React.SetStateAction<boolean>>;
  canUndoGeneralAction: boolean;
  canRedoGeneralAction: boolean;
  handleUndoGeneralAction: () => void;
  handleRedoGeneralAction: () => void;
};

export function useExpertEditStageKeyboardBindings({
  panelRootRef,
  isMarkupExpandSelected,
  isMorePresetsSurfaceOpen,
  setIsMarkupPanSpacePressed,
  canUndoGeneralAction,
  canRedoGeneralAction,
  handleUndoGeneralAction,
  handleRedoGeneralAction,
}: UseExpertEditStageKeyboardBindingsArgs) {
  React.useEffect(() => {
    const isMarkupPanKeyboardListeningEnabled = isMarkupExpandSelected || !isMorePresetsSurfaceOpen;
    if (!isMarkupPanKeyboardListeningEnabled) {
      setIsMarkupPanSpacePressed(false);
      return;
    }
    if (typeof window === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isSpaceActivationKey(event)) return;
      if (isKeyboardEventFromInteractiveTarget(event)) return;
      event.preventDefault();
      setIsMarkupPanSpacePressed(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (!isSpaceActivationKey(event)) return;
      setIsMarkupPanSpacePressed(false);
      if (isKeyboardEventFromInteractiveTarget(event)) return;
      event.preventDefault();
    };
    const handleWindowBlur = () => {
      setIsMarkupPanSpacePressed(false);
    };

    window.addEventListener("keydown", handleKeyDown, {
      capture: true,
    });
    window.addEventListener("keyup", handleKeyUp, {
      capture: true,
    });
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, {
        capture: true,
      });
      window.removeEventListener("keyup", handleKeyUp, {
        capture: true,
      });
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [isMarkupExpandSelected, isMorePresetsSurfaceOpen, setIsMarkupPanSpacePressed]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handleHistoryHotkey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.altKey) return;
      const panelRoot = panelRootRef.current;
      const eventTarget = event.target;
      const activeElement = document.activeElement;
      const isInsidePanel =
        isMarkupExpandSelected ||
        (!!panelRoot &&
          ((eventTarget instanceof Node && panelRoot.contains(eventTarget)) ||
            (activeElement instanceof Node && panelRoot.contains(activeElement))));
      if (!isInsidePanel) return;
      if (isKeyboardEventFromEditableTarget(event)) return;
      const hasModifier = event.metaKey || event.ctrlKey;
      if (!hasModifier) return;
      const key = event.key.toLowerCase();
      const isUndo = key === "z" && !event.shiftKey;
      const isRedo = (key === "z" && event.shiftKey) || key === "y";
      if (!isUndo && !isRedo) return;
      event.preventDefault();
      if (isUndo) {
        if (!canUndoGeneralAction) return;
        handleUndoGeneralAction();
        return;
      }
      if (!canRedoGeneralAction) return;
      handleRedoGeneralAction();
    };

    window.addEventListener("keydown", handleHistoryHotkey);
    return () => {
      window.removeEventListener("keydown", handleHistoryHotkey);
    };
  }, [
    canRedoGeneralAction,
    canUndoGeneralAction,
    handleRedoGeneralAction,
    handleUndoGeneralAction,
    isMarkupExpandSelected,
    panelRootRef,
  ]);
}
