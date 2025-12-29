/**
 * Compact card used in the performance list.
 * Displays a ranked video snapshot and forwards click intent back to the parent for modal handling.
 * Kept isolated so the list view in the page stays readable.
 */
import { ScoredVideo } from "../types";
import { formatAgo, formatCompact, formatPercent } from "../utils/formatters";

export type CompactVideoCardProps = {
  video: ScoredVideo;
  onSelect: (video: ScoredVideo) => void;
};

/**
 * Render a small performance summary tile; clicking opens the detail modal.
 */
export function CompactVideoCard({ video, onSelect }: CompactVideoCardProps) {
  return (
    <article
      className="compact-card"
      onClick={() => onSelect(video)}
      role="button"
      tabIndex={0}
      aria-pressed="false"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(video);
        }
      }}
    >
      <div className="compact-thumb">
        <img src={video.thumbnail_url || ""} alt={video.caption_text || "Video thumbnail"} loading="lazy" />
        <span className="rank-badge">#{video.rank}</span>
      </div>
      <div className="compact-body">
        <h4 className="compact-title" title={video.caption_text || ""}>
          {video.caption_text || "Untitled"}
        </h4>
        <div className="compact-metrics">
          <span className="metric-views">{formatCompact(video.views)} views</span>
          <span className="outlier-badge">{video.outlierMultiplier.toFixed(1)}× over median</span>
        </div>
        <div className="compact-meta">
          <span className={`platform-pill tiny ${video.platform}`}>{video.platform_label}</span>
          <span className="pill tiny">{video.category}</span>
          <span className="pill tiny">{formatAgo(video.publish_time)}</span>
          <span className="pill tiny">ER {formatPercent(video.engagement_rate)}</span>
        </div>
      </div>
    </article>
  );
}
