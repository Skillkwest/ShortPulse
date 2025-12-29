/**
 * Modal that surfaces an expanded performance breakdown for a selected video.
 * Isolated to keep modal focus/aria handling contained and reusable.
 */
import Link from "next/link";
import { ScoredVideo } from "../types";
import { formatAgo, formatCompact, formatHandle, formatPercent } from "../utils/formatters";

export type VideoDetailModalProps = {
  video?: ScoredVideo;
  open: boolean;
  onClose: () => void;
};

/**
 * Present modal contents for a scored video; renders nothing when closed.
 */
export function VideoDetailModal({ video, open, onClose }: VideoDetailModalProps) {
  if (!open || !video) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-shell"
        role="dialog"
        aria-modal="true"
        aria-label="Video detail"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="modal-row">
          <div className="modal-thumb phone">
            <img src={video.thumbnail_url || ""} alt={video.caption_text || ""} />
          </div>
          <div className="modal-column">
            <p className="eyebrow">{video.platform_label.toUpperCase()}</p>
            <h3 className="modal-title">{video.caption_text || "Untitled"}</h3>
            <p className="subdued">
              {formatHandle(video.creator_username)} · {formatAgo(video.publish_time)}
            </p>
            <div className="pill-stack">
              <span className="pill pill-amber">Rank #{video.rank}</span>
              <span className="pill pill-teal">{video.category}</span>
            </div>

            <div className="snapshot">
              <p className="tiny subdued">Performance snapshot</p>
              <div className="snapshot-row">
                <span className="pill pill-ghost strong">{formatCompact(video.views)} views</span>
                <span className="pill pill-amber strong">Outlier {video.outlierMultiplier.toFixed(2)}×</span>
                <span className="pill pill-ghost">{formatCompact(video.views_per_hour)}/hr</span>
                <span className="pill pill-ghost">ER {formatPercent(video.engagement_rate)}</span>
              </div>
            </div>

            <div className="modal-metric-grid">
              <div>
                <p className="metric-label">Views</p>
                <p className="metric-value">{formatCompact(video.views)}</p>
                <p className="metric-label tiny">IQR fence {formatCompact(video.iqrUpperFence)}</p>
              </div>
              <div>
                <p className="metric-label">Outlier factor</p>
                <p className="metric-value">{video.outlierMultiplier.toFixed(2)}×</p>
                <p className="metric-label tiny">Platform median {formatCompact(video.baselineViews)}</p>
              </div>
              <div>
                <p className="metric-label">Velocity</p>
                <p className="metric-value">{formatCompact(video.views_per_hour)}/hr</p>
                <p className="metric-label tiny">{video.views_per_hour_percentile.toFixed(1)}pctl</p>
              </div>
              <div>
                <p className="metric-label">Engagement</p>
                <p className="metric-value">{formatPercent(video.engagement_rate)}</p>
                <p className="metric-label tiny">Comments {formatCompact(video.comments)}</p>
              </div>
              <div>
                <p className="metric-label">Shares/Saves</p>
                <p className="metric-value">{formatCompact(video.shares_or_saves || 0)}</p>
                <p className="metric-label tiny">Likes {formatCompact(video.likes)}</p>
              </div>
              <div>
                <p className="metric-label">Completion</p>
                <p className="metric-value">{formatPercent(video.completion_rate)}</p>
                <p className="metric-label tiny">Avg watch {video.watch_time_seconds}s</p>
              </div>
            </div>

            <div className="modal-divider" />
            <div className="modal-actions">
              <Link href={video.reel_url} target="_blank" rel="noreferrer" className="primary-btn full">
                Open on platform ↗
              </Link>
            </div>

            <details className="modal-accordion">
              <summary>Analytics breakdown</summary>
              <p className="subdued tiny">
                Outlier = views ÷ platform median (time window). IQR upper fence = Q3 + 1.5×IQR. Velocity = views per
                hour. Engagement = likes + comments + saves vs views.
              </p>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
