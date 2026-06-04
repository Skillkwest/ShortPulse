/**
 * Modal that surfaces an expanded performance breakdown for a selected video.
 * Isolated to keep modal focus/aria handling contained and reusable.
 */
import Link from "next/link";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";
import { performanceClass } from "../performanceRouteStyles";
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
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(onClose, {
    disabled: !open || !video,
  });
  if (!open || !video) return null;
  return (
    <div className={performanceClass("modal-backdrop")} {...backdropDismiss}>
      <div
        className={performanceClass("modal-shell")}
        role="dialog"
        aria-modal="true"
        aria-label="Video detail"
        onClick={(e) => e.stopPropagation()}
      >
        <button className={performanceClass("modal-close")} onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className={performanceClass("modal-row")}>
          <div className={performanceClass("modal-thumb", "phone")}>
            {/* Source host can vary with upstream platform data. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={video.thumbnail_url || ""} alt={video.caption_text || ""} />
          </div>
          <div className={performanceClass("modal-column")}>
            <p className="eyebrow">{video.platform_label.toUpperCase()}</p>
            <h3 className={performanceClass("modal-title")}>{video.caption_text || "Untitled"}</h3>
            <p className="subdued">
              {formatHandle(video.creator_username)} · {formatAgo(video.publish_time)}
            </p>
            <div className={performanceClass("pill-stack")}>
              <span className={performanceClass("pill", "pill-amber")}>Rank #{video.rank}</span>
              <span className={performanceClass("pill", "pill-teal")}>{video.category}</span>
            </div>

            <div className={performanceClass("snapshot")}>
              <p className="tiny subdued">Performance snapshot</p>
              <div className={performanceClass("snapshot-row")}>
                <span className={performanceClass("pill", "pill-ghost", "strong")}>
                  {formatCompact(video.views)} views
                </span>
                <span className={performanceClass("pill", "pill-amber", "strong")}>
                  Outlier {video.outlierMultiplier.toFixed(2)}×
                </span>
                <span className={performanceClass("pill", "pill-ghost")}>
                  {formatCompact(video.views_per_hour)}/hr
                </span>
                <span className={performanceClass("pill", "pill-ghost")}>
                  ER {formatPercent(video.engagement_rate)}
                </span>
              </div>
            </div>

            <div className={performanceClass("modal-metric-grid")}>
              <div>
                <p className={performanceClass("metric-label")}>Views</p>
                <p className={performanceClass("metric-value")}>{formatCompact(video.views)}</p>
                <p className={performanceClass("metric-label", "tiny")}>
                  IQR fence {formatCompact(video.iqrUpperFence)}
                </p>
              </div>
              <div>
                <p className={performanceClass("metric-label")}>Outlier factor</p>
                <p className={performanceClass("metric-value")}>
                  {video.outlierMultiplier.toFixed(2)}×
                </p>
                <p className={performanceClass("metric-label", "tiny")}>
                  Platform median {formatCompact(video.baselineViews)}
                </p>
              </div>
              <div>
                <p className={performanceClass("metric-label")}>Velocity</p>
                <p className={performanceClass("metric-value")}>
                  {formatCompact(video.views_per_hour)}/hr
                </p>
                <p className={performanceClass("metric-label", "tiny")}>
                  {video.views_per_hour_percentile.toFixed(1)}pctl
                </p>
              </div>
              <div>
                <p className={performanceClass("metric-label")}>Engagement</p>
                <p className={performanceClass("metric-value")}>
                  {formatPercent(video.engagement_rate)}
                </p>
                <p className={performanceClass("metric-label", "tiny")}>
                  Comments {formatCompact(video.comments)}
                </p>
              </div>
              <div>
                <p className={performanceClass("metric-label")}>Shares/Saves</p>
                <p className={performanceClass("metric-value")}>
                  {formatCompact(video.shares_or_saves || 0)}
                </p>
                <p className={performanceClass("metric-label", "tiny")}>
                  Likes {formatCompact(video.likes)}
                </p>
              </div>
              <div>
                <p className={performanceClass("metric-label")}>Completion</p>
                <p className={performanceClass("metric-value")}>
                  {formatPercent(video.completion_rate)}
                </p>
                <p className={performanceClass("metric-label", "tiny")}>
                  Avg watch {video.watch_time_seconds}s
                </p>
              </div>
            </div>

            <div className={performanceClass("modal-divider")} />
            <div className={performanceClass("modal-actions")}>
              <Link
                href={video.reel_url}
                target="_blank"
                rel="noreferrer"
                className={performanceClass("primary-btn", "full")}
              >
                Open on platform ↗
              </Link>
            </div>

            <details className={performanceClass("modal-accordion")}>
              <summary>Analytics breakdown</summary>
              <p className="subdued tiny">
                Outlier = views ÷ platform median (time window). IQR upper fence = Q3 + 1.5×IQR.
                Velocity = views per hour. Engagement = likes + comments + saves vs views.
              </p>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
