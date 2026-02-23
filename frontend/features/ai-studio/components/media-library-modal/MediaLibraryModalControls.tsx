import React from "react";
import {
  CloudArrowDown,
  ImageSquare,
  LockSimple,
  MagnifyingGlass,
  VideoCamera,
  X,
} from "phosphor-react";
import type { MediaTab } from "../../logic/mediaLibraryModalModel";

type MediaLibraryModalControlsProps = {
  activeTab: MediaTab;
  isMediaTab: boolean;
  search: string;
  onClose: () => void;
  onTabChange: (tab: MediaTab) => void;
  onSearchChange: (value: string) => void;
};

export function MediaLibraryModalControls({
  activeTab,
  isMediaTab,
  search,
  onClose,
  onTabChange,
  onSearchChange,
}: MediaLibraryModalControlsProps) {
  return (
    <>
      <div className="media-library-modal-header">
        <div>
          <p className="eyebrow">Media Library</p>
          <p className="tiny subdued helper-text">
            Select media or prompts to add to the reference grid.
          </p>
        </div>
        <button
          type="button"
          className="art-close-btn"
          onClick={onClose}
          aria-label="Close media library"
        >
          <X size={18} weight="bold" />
        </button>
      </div>

      <div className="media-library-modal-tabs" role="tablist" aria-label="Media library tabs">
        <button
          type="button"
          role="tab"
          className={`media-library-tab ${activeTab === "uploaded_images" ? "is-active" : ""}`}
          aria-selected={activeTab === "uploaded_images"}
          onClick={() => onTabChange("uploaded_images")}
        >
          <ImageSquare size={14} weight="bold" aria-hidden />
          Uploaded Images
        </button>
        <button
          type="button"
          role="tab"
          className={`media-library-tab ${activeTab === "uploaded_videos" ? "is-active" : ""}`}
          aria-selected={activeTab === "uploaded_videos"}
          onClick={() => onTabChange("uploaded_videos")}
        >
          <VideoCamera size={14} weight="bold" aria-hidden />
          Uploaded Videos
        </button>
        <button
          type="button"
          role="tab"
          className={`media-library-tab ${activeTab === "saved_prompts" ? "is-active" : ""}`}
          aria-selected={activeTab === "saved_prompts"}
          onClick={() => onTabChange("saved_prompts")}
        >
          <CloudArrowDown size={14} weight="bold" aria-hidden />
          Saved Prompts
        </button>
        <button
          type="button"
          role="tab"
          className={`media-library-tab ${activeTab === "ai_generations" ? "is-active" : ""}`}
          aria-selected={activeTab === "ai_generations"}
          onClick={() => onTabChange("ai_generations")}
        >
          <CloudArrowDown size={14} weight="bold" aria-hidden />
          AI Studio Generations
        </button>
        <button
          type="button"
          role="tab"
          className={`media-library-tab ${activeTab === "private" ? "is-active" : ""}`}
          aria-selected={activeTab === "private"}
          onClick={() => onTabChange("private")}
        >
          <LockSimple size={14} weight="bold" aria-hidden />
          Private
        </button>
      </div>

      <div className="media-library-modal-search">
        <div className="search-input">
          <MagnifyingGlass size={15} weight="bold" aria-hidden />
          <input
            type="text"
            placeholder={isMediaTab ? "Search media by name or file" : "Search saved prompts"}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </div>
    </>
  );
}
