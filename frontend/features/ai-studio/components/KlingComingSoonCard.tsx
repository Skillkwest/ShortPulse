/**
 * Temporary placeholder for the Kling 3.0 tool until the full properties panel ships.
 */
import React from "react";
import { VideoCamera } from "phosphor-react";

export function KlingComingSoonCard() {
  return (
    <div className="kling-coming-soon-card">
      <div className="kling-coming-soon-card__header">
        <VideoCamera size={22} weight="bold" color="#22d3ee" />
        <h3>Kling 3.0</h3>
      </div>
      <p>
        Generate cinematic videos with intelligent multi-shot composition, dynamic camera movements,
        and native audio. Perfect for creating story-driven content with professional motion quality.
      </p>
      <div
        style={{
          marginTop: "24px",
          padding: "16px",
          borderRadius: "10px",
          background: "rgba(6, 182, 212, 0.08)",
          border: "1px solid rgba(6, 182, 212, 0.2)",
        }}
      >
        <p style={{ color: "var(--ai-card-text)", fontSize: "13px", margin: 0, fontStyle: "italic" }}>
          The full Kling 3.0 workflow is coming soon with advanced shot controls and reference options.
        </p>
      </div>
    </div>
  );
}
