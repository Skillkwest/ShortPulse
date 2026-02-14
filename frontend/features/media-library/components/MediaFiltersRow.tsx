/**
 * Filters-row shell for Media Library.
 * Composes the dashboard navigation prefab card with filter/search tab controls.
 */
import { DashboardNavPrefab } from "../../../components/DashboardNavPrefab";
import { MediaFiltersPanel, type MediaFiltersPanelProps } from "./MediaFiltersPanel";

export type MediaFiltersRowProps = MediaFiltersPanelProps;

/**
 * Renders the media-filters row with workspace navigation and filter/search controls.
 * Inputs: Media filter panel props and callbacks.
 * Output: combined row markup for page-level composition.
 * Side effects: none.
 */
export function MediaFiltersRow({
  activeTab,
  countLabel,
  search,
  visibleCount,
  onSearchChange,
  onSelectTab,
}: MediaFiltersRowProps) {
  return (
    <div className="media-filters-row">
      <div
        className="panel media-filter-dashboard-card media-panel"
        aria-label="Workspace navigation"
      >
        <DashboardNavPrefab />
      </div>
      <MediaFiltersPanel
        activeTab={activeTab}
        countLabel={countLabel}
        search={search}
        visibleCount={visibleCount}
        onSearchChange={onSearchChange}
        onSelectTab={onSelectTab}
      />
    </div>
  );
}
