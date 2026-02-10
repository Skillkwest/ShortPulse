/**
 * Compact card used in the performance list.
 * Displays a ranked video snapshot and forwards click intent back to the parent for modal handling.
 * Kept isolated so the list view in the page stays readable.
 */
import { ScoredVideo } from "../types";
import { formatCompact } from "../utils/formatters";

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
        {/* Source host can vary with upstream platform data. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={video.thumbnail_url || ""}
          alt={video.caption_text || "Video thumbnail"}
          loading="lazy"
        />
        <span className="rank-badge">#{video.rank}</span>
      </div>
      <div className="compact-body">
        <div className="score-bar">
          <span className="score-label">Performance score:</span>
          <span className="score-value">{video.performance_score.toFixed(1)}</span>
        </div>
        <div className="metric-row primary">
          <div>
            <p className="metric-label">Views</p>
            <p className="metric-value">{formatCompact(video.views)}</p>
          </div>
          <div className="metric-block">
            <p className="metric-label">Outlier</p>
            <p className="metric-value outlier">
              {video.outlierMultiplier.toFixed(1)}× over median
            </p>
          </div>
        </div>
        <div className="metric-row secondary">
          <div className="meta-group">
            <span className="meta-label">Platform</span>
            <span className={`platform-pill tiny ${video.platform}`}>{video.platform_label}</span>
          </div>
          <div className="meta-group">
            <span className="meta-label">Niche</span>
            <span className="pill tiny">{video.category}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
