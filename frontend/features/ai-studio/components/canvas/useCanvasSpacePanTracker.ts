/**
 * Space-pan key tracker for canvas instances.
 * Tracks physical Space key state while preserving editable text input behavior.
 */
import { useEffect, useRef } from "react";

const isEditableKeyboardTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true']"));
};

/**
 * Returns a mutable ref that indicates whether the Space key is currently held.
 *
 * Editable controls still receive normal Space typing because the tracker only
 * prevents default on non-editable keyboard targets.
 */
export const useCanvasSpacePanTracker = () => {
  const isSpacePanActiveRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.code !== "Space") return;
      isSpacePanActiveRef.current = true;
      if (isEditableKeyboardTarget(event.target)) return;
      event.preventDefault();
    };
    const handleKeyUp = (event: globalThis.KeyboardEvent) => {
      if (event.code !== "Space") return;
      isSpacePanActiveRef.current = false;
      if (isEditableKeyboardTarget(event.target)) return;
      event.preventDefault();
    };
    const handleWindowBlur = () => {
      isSpacePanActiveRef.current = false;
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
      isSpacePanActiveRef.current = false;
    };
  }, []);

  return isSpacePanActiveRef;
};
