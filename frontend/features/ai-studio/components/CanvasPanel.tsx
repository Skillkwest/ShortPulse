/**
 * Canvas automation workflow builder panel.
 * Placeholder for future node-based workflow creation interface.
 */
import React from "react";
import { Graph } from "phosphor-react";

export function CanvasPanel() {
  return (
    <div style={{ padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <Graph size={24} weight="bold" color="#a78bf7" />
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Canvas</h3>
      </div>
      <p style={{ color: "var(--ai-card-text)", fontSize: "14px", lineHeight: "1.5", margin: 0 }}>
        Design and automate complex workflows with a visual node-based builder. Chain AI models, add conditional logic, and create powerful multi-step creative pipelines.
      </p>
      <div
        style={{
          marginTop: "24px",
          padding: "16px",
          borderRadius: "10px",
          background: "rgba(124, 92, 255, 0.08)",
          border: "1px solid rgba(124, 92, 255, 0.2)",
        }}
      >
        <p style={{ color: "var(--ai-card-text)", fontSize: "13px", margin: 0, fontStyle: "italic" }}>
          Canvas node builder coming soon.
        </p>
      </div>
    </div>
  );
}
