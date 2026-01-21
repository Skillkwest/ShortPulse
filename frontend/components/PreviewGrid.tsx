/* eslint-disable @next/next/no-img-element */
/**
 * Lightweight preview grid for the demo cards.
 * Normalizes thumbnails so other parts of the app can swap in real imagery without reworking layout.
 */
import React, { useMemo } from "react";
import { ReelPerformance } from "../features/performance/types";

type Props = {
  items: ReelPerformance[];
  loading: boolean;
  fallbackImages?: string[];
};

const defaultImages = [
  "https://images.pexels.com/photos/3756766/pexels-photo-3756766.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/2608517/pexels-photo-2608517.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/1181622/pexels-photo-1181622.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/3771836/pexels-photo-3771836.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/3807517/pexels-photo-3807517.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=600",
];

const formatCompact = (value: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);

/**
 * Display a grid of preview tiles for the provided items.
 */
export function PreviewGrid({ items, loading, fallbackImages = defaultImages }: Props) {
  const normalized = useMemo(() => {
    if (!items.length) return [];
    return items.slice(0, 12).map((item, idx) => ({
      ...item,
      thumbnail_url: item.thumbnail_url || fallbackImages[idx % fallbackImages.length],
    }));
  }, [items, fallbackImages]);

  return (
    <section className="preview-section">
      <div className="preview-header">
        <div>
          <p className="eyebrow">Recent performers</p>
          <h3 className="preview-title">Reel preview cards</h3>
          <p className="subdued">Dummy thumbnails to mirror the research view.</p>
        </div>
        <span className="chip">Sample · {normalized.length || "—"}</span>
      </div>

      {loading && !normalized.length ? (
        <div className="preview-grid skeleton">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="preview-card skeleton-tile" key={i} />
          ))}
        </div>
      ) : (
        <div className="preview-grid">
          {normalized.map((item) => (
            <article className="preview-card" key={item.reel_id}>
              <div className="preview-thumb">
                <img src={item.thumbnail_url} alt="" loading="lazy" />
                <div className="preview-overlay" />
                <div className="preview-top">
                  <span className="pill pill-teal">{item.platform || "reel"}</span>
                  <span className="pill pill-amber">{formatCompact(item.views)} views</span>
                </div>
                <div className="preview-bottom">
                  <div className="meta">
                    <p className="meta-title">{item.creator_username || "Creator handle"}</p>
                    <p className="meta-sub">
                      {item.caption_text || "Loop-worthy hook. Catchy beat. High velocity."}
                    </p>
                  </div>
                  <div className="score-badge">
                    <span className="score-label">Score</span>
                    <span className="score-value">{item.performance_score.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
