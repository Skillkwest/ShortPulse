/**
 * Header hero for Media Library.
 * Renders title/description and compact cards for storage usage and active plan status.
 */
import { CloudArrowUp, ShieldCheck } from "phosphor-react";

export type MediaLibraryHeaderProps = {
  planLabel: string;
  planName: string;
  storageUsageValue: string;
};

/**
 * Renders the page-level Media Library header.
 * Inputs: computed storage usage value and plan metadata labels.
 * Output: hero section with heading text and status cards.
 * Side effects: none.
 */
export function MediaLibraryHeader({
  planLabel,
  planName,
  storageUsageValue,
}: MediaLibraryHeaderProps) {
  return (
    <section className="panel saved-header-bar saved-hero hero-image-card">
      <div className="saved-header-left">
        <div className="saved-title-stack">
          <div className="saved-title-row">
            <h1 className="title">Media Library</h1>
          </div>
          <p className="subdued">Upload, organize, and manage your workspace media in one place.</p>
        </div>
      </div>
      <div className="header-cards media-header-cards">
        <div className="header-stat-card" aria-label="Media storage">
          <div className="status-icon compact" aria-hidden="true">
            <CloudArrowUp size={18} weight="bold" />
          </div>
          <div className="header-card-body">
            <p className="metric-label tiny">Media storage</p>
            <p className="status-value small">{storageUsageValue}</p>
          </div>
        </div>
        <div className="header-stat-card" aria-label="Plan status">
          <div className="status-icon compact" aria-hidden="true">
            <ShieldCheck size={16} weight="bold" />
          </div>
          <div className="header-card-body">
            <p className="metric-label tiny">{planLabel}</p>
            <p className="status-value small">{planName}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
