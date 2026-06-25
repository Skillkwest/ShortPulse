/**
 * Video workflow mode tabs for Standard, Motion Control, and Lip Sync.
 */
import React from "react";
import type { VideoReferenceMode } from "../../types";
import { handleVideoSegmentedTabListKeyDown } from "./videoSegmentedTabs";

const VIDEO_REFERENCE_MODE_TAB_VALUES: VideoReferenceMode[] = ["standard", "motion", "lip-sync"];

type VideoModeTabsProps = {
  visibleVideoMode: "standard" | "motion" | "lip-sync";
  videoModeIndex: number;
  style: React.CSSProperties;
  onVideoReferenceModeChange?: (value: VideoReferenceMode) => void;
};

/**
 * Renders the top-level Video mode segmented control without owning mode state.
 */
export function VideoModeTabs({
  visibleVideoMode,
  videoModeIndex,
  style,
  onVideoReferenceModeChange,
}: VideoModeTabsProps) {
  return (
    <div
      className="video-reference-mode-tabs"
      role="tablist"
      aria-label="Video reference mode"
      style={style}
      onKeyDown={(event) =>
        handleVideoSegmentedTabListKeyDown(
          event,
          videoModeIndex,
          VIDEO_REFERENCE_MODE_TAB_VALUES.length,
          (index) => onVideoReferenceModeChange?.(VIDEO_REFERENCE_MODE_TAB_VALUES[index])
        )
      }
    >
      <span className="video-reference-mode-indicator" aria-hidden="true" />
      <button
        type="button"
        role="tab"
        aria-selected={visibleVideoMode === "standard"}
        tabIndex={visibleVideoMode === "standard" ? 0 : -1}
        className={`video-reference-mode-tab ${visibleVideoMode === "standard" ? "is-active" : ""}`}
        onClick={() => onVideoReferenceModeChange?.("standard")}
      >
        Standard
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={visibleVideoMode === "motion"}
        tabIndex={visibleVideoMode === "motion" ? 0 : -1}
        className={`video-reference-mode-tab ${visibleVideoMode === "motion" ? "is-active" : ""}`}
        onClick={() => onVideoReferenceModeChange?.("motion")}
      >
        Motion Control
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={visibleVideoMode === "lip-sync"}
        tabIndex={visibleVideoMode === "lip-sync" ? 0 : -1}
        className={`video-reference-mode-tab ${visibleVideoMode === "lip-sync" ? "is-active" : ""}`}
        onClick={() => onVideoReferenceModeChange?.("lip-sync")}
      >
        Lip Sync
      </button>
    </div>
  );
}
