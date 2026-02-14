/**
 * Filter/search panel for Media Library.
 * Renders tab category toggles, visible item count, and search input for media/prompt views.
 */
import { LockSimple, MagnifyingGlass } from "phosphor-react";

export type MediaFilterTab =
  | "uploaded_images"
  | "uploaded_videos"
  | "private"
  | "saved_prompts"
  | "ai_generations";

export type MediaFiltersPanelProps = {
  activeTab: MediaFilterTab;
  countLabel: string;
  search: string;
  visibleCount: number;
  onSearchChange: (value: string) => void;
  onSelectTab: (tab: MediaFilterTab) => void;
};

/**
 * Renders the Media Library filter controls.
 * Inputs: active tab/search state, count text, and change handlers.
 * Output: tab strip + search field + visible count chip.
 * Side effects: none.
 */
export function MediaFiltersPanel({
  activeTab,
  countLabel,
  search,
  visibleCount,
  onSearchChange,
  onSelectTab,
}: MediaFiltersPanelProps) {
  const isPromptTab = activeTab === "saved_prompts";

  return (
    <section className="panel media-filters media-panel" aria-label="Media filters and search">
      <div className="filter-tabs" role="tablist" aria-label="Media categories">
        <button
          type="button"
          className={`pill-toggle big ${activeTab === "uploaded_images" ? "active" : ""}`}
          onClick={() => onSelectTab("uploaded_images")}
        >
          Uploaded Images
        </button>
        <button
          type="button"
          className={`pill-toggle big ${activeTab === "uploaded_videos" ? "active" : ""}`}
          onClick={() => onSelectTab("uploaded_videos")}
        >
          Uploaded Videos
        </button>
        <button
          type="button"
          className={`pill-toggle big ${activeTab === "saved_prompts" ? "active" : ""}`}
          onClick={() => onSelectTab("saved_prompts")}
        >
          Saved Prompts
        </button>
        <button
          type="button"
          className={`pill-toggle big ${activeTab === "ai_generations" ? "active" : ""}`}
          onClick={() => onSelectTab("ai_generations")}
        >
          AI Studio Generations
        </button>
        <button
          type="button"
          className={`pill-toggle big ${activeTab === "private" ? "active" : ""}`}
          onClick={() => onSelectTab("private")}
        >
          <LockSimple size={14} weight="bold" aria-hidden />
          Private
        </button>
      </div>
      <span className="pill tiny filter-count">
        {visibleCount} {countLabel}
      </span>
      <div className="search-wrap">
        <div className="search-input">
          <MagnifyingGlass size={16} weight="bold" />
          <input
            type="text"
            placeholder={isPromptTab ? "Search saved prompts" : "Search media by name or file"}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </div>
    </section>
  );
}
