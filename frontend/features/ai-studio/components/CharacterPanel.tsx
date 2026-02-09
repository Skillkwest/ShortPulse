/**
 * Placeholder panel for the Character tool inside AI Studio.
 */
import React from "react";
import { User } from "phosphor-react";

export function CharacterPanel() {
  return (
    <div style={{ padding: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <User size={24} weight="bold" color="#06b6d4" />
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Character</h3>
      </div>
      <p style={{ color: "var(--ai-card-text)", fontSize: "14px", lineHeight: "1.5", margin: 0 }}>
        Create consistent characters across series of generations. Capture traits, poses, and styling notes once so you can reference
        them later when refining your cast.
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
          Keep a quick reminder of the details that matter for each character.
        </p>
      </div>
    </div>
  );
}
