import React from "react";

export type DetailNavigationKeyContract = {
  canNavigatePrevious: boolean;
  canNavigateNext: boolean;
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
};

export const shouldIgnoreDetailNavigationKeyEvent = (event: KeyboardEvent): boolean => {
  if (event.defaultPrevented) return true;
  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  if (["input", "textarea", "select", "audio", "video"].includes(tagName)) return true;
  return Boolean(
    target.closest(
      "input, textarea, select, audio, video, [contenteditable='true'], [role='textbox'], [role='slider']"
    )
  );
};

export const useDetailNavigationKeys = ({
  isEnabled,
  navigation,
}: {
  isEnabled: boolean;
  navigation?: DetailNavigationKeyContract | null;
}) => {
  React.useEffect(() => {
    if (!isEnabled || !navigation || typeof document === "undefined") return;
    const handleDetailNavigationKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreDetailNavigationKeyEvent(event)) return;
      if (event.key === "ArrowLeft") {
        if (!navigation.canNavigatePrevious) return;
        event.preventDefault();
        navigation.onNavigatePrevious();
        return;
      }
      if (event.key === "ArrowRight") {
        if (!navigation.canNavigateNext) return;
        event.preventDefault();
        navigation.onNavigateNext();
      }
    };
    document.addEventListener("keydown", handleDetailNavigationKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDetailNavigationKeyDown);
    };
  }, [isEnabled, navigation]);
};
