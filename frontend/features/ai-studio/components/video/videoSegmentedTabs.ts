/**
 * Shared keyboard behavior for Video workflow segmented tab controls.
 */
import type React from "react";

/**
 * Moves focus and selection across a roving tablist by arrow, Home, or End keys.
 */
export const handleVideoSegmentedTabListKeyDown = (
  event: React.KeyboardEvent<HTMLElement>,
  activeIndex: number,
  tabCount: number,
  selectIndex: (index: number) => void
) => {
  if (tabCount <= 0) return;
  let nextIndex: number | null = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = (activeIndex + 1) % tabCount;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = (activeIndex - 1 + tabCount) % tabCount;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = tabCount - 1;
  }
  if (nextIndex == null) return;
  event.preventDefault();
  selectIndex(nextIndex);
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  tabs[nextIndex]?.focus({ preventScroll: true });
};
