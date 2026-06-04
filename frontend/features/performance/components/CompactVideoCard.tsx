/**
 * Compact card used in the performance list.
 * Displays a ranked video snapshot and forwards click intent back to the parent for modal handling.
 * Kept isolated so the list view in the page stays readable.
 */
import { ScoredVideo } from "../types";
import { performanceClass } from "../performanceRouteStyles";
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
      className={performanceClass("compact-card")}
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
      <div className={performanceClass("compact-thumb")}>
        {/* Source host can vary with upstream platform data. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={video.thumbnail_url || ""}
          alt={video.caption_text || "Video thumbnail"}
          loading="lazy"
        />
        <span className={performanceClass("rank-badge")}>#{video.rank}</span>
      </div>
      <div className={performanceClass("compact-body")}>
        <div className={performanceClass("score-bar")}>
          <span className={performanceClass("score-label")}>Performance score:</span>
          <span className={performanceClass("score-value")}>
            {video.performance_score.toFixed(1)}
          </span>
        </div>
        <div className={performanceClass("metric-row", "primary")}>
          <div>
            <p className={performanceClass("metric-label")}>Views</p>
            <p className={performanceClass("metric-value")}>{formatCompact(video.views)}</p>
          </div>
          <div className={performanceClass("metric-block")}>
            <p className={performanceClass("metric-label")}>Outlier</p>
            <p className={performanceClass("metric-value", "outlier")}>
              {video.outlierMultiplier.toFixed(1)}× over median
            </p>
          </div>
        </div>
        <div className={performanceClass("metric-row", "secondary")}>
          <div className={performanceClass("meta-group")}>
            <span className={performanceClass("meta-label")}>Platform</span>
            <span className={performanceClass("platform-pill", "tiny", video.platform)}>
              {video.platform_label}
            </span>
          </div>
          <div className={performanceClass("meta-group")}>
            <span className={performanceClass("meta-label")}>Niche</span>
            <span className={performanceClass("pill", "tiny")}>{video.category}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
