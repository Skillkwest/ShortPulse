/**
 * Browser-openable Phase 1 bakeoff lab for comparing stage substrates outside the AI Studio shell.
 * Mounts three minimal candidates against the same viewport/artboard/layer checklist.
 */
import React from "react";
import dynamic from "next/dynamic";

import { StageBakeoffDomCandidate } from "./StageBakeoffDomCandidate";
import { STAGE_BAKEOFF_CHECKLIST } from "./stageBakeoffShared";

const StageBakeoffKonvaCandidate = dynamic(
  () => import("./StageBakeoffKonvaCandidate").then((module) => module.StageBakeoffKonvaCandidate),
  {
    ssr: false,
    loading: () => <p>Loading Konva candidate…</p>,
  }
);

const StageBakeoffFabricCandidate = dynamic(
  () =>
    import("./StageBakeoffFabricCandidate").then((module) => module.StageBakeoffFabricCandidate),
  {
    ssr: false,
    loading: () => <p>Loading Fabric candidate…</p>,
  }
);

type CandidateId = "dom" | "konva" | "fabric";

const candidateLabels: Record<CandidateId, string> = {
  dom: "DOM/CSS",
  konva: "Konva",
  fabric: "Fabric.js",
};

/**
 * Renders the isolated Phase 1 bakeoff UI.
 */
export function MasterStageBakeoffLab() {
  const [candidate, setCandidate] = React.useState<CandidateId>("dom");

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 24px 56px",
        background: "#f4efe6",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: "1180px", margin: "0 auto", display: "grid", gap: "24px" }}>
        <section style={{ display: "grid", gap: "12px" }}>
          <span
            style={{
              display: "inline-flex",
              width: "fit-content",
              padding: "6px 10px",
              borderRadius: "999px",
              background: "rgba(15, 23, 42, 0.08)",
              fontSize: "0.82rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            AI Studio Stage Bakeoff
          </span>
          <h1 style={{ margin: 0, fontSize: "2.2rem", lineHeight: 1.1 }}>
            Phase 1 lab for the new master workspace and artboard editor
          </h1>
          <p style={{ margin: 0, maxWidth: "72ch", color: "#334155", lineHeight: 1.6 }}>
            This route stays outside the production AI Studio shell on purpose. It compares a plain
            DOM/CSS stage, a Konva stage, and a Fabric.js stage against the same minimal editor
            checklist before any live-stage cutover work begins.
          </p>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
            gap: "24px",
            alignItems: "start",
          }}
        >
          <aside
            style={{
              display: "grid",
              gap: "18px",
              padding: "20px",
              borderRadius: "22px",
              background: "rgba(255, 255, 255, 0.72)",
              boxShadow: "0 10px 26px rgba(15, 23, 42, 0.08)",
            }}
          >
            <div style={{ display: "grid", gap: "10px" }}>
              <strong>Checklist</strong>
              <ul style={{ margin: 0, paddingLeft: "18px", color: "#334155", lineHeight: 1.55 }}>
                {STAGE_BAKEOFF_CHECKLIST.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div style={{ display: "grid", gap: "10px" }}>
              <strong>Candidates</strong>
              <div style={{ display: "grid", gap: "8px" }}>
                {(["dom", "konva", "fabric"] as CandidateId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCandidate(id)}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: "14px",
                      border:
                        candidate === id
                          ? "1px solid rgba(37, 99, 235, 0.5)"
                          : "1px solid rgba(15, 23, 42, 0.08)",
                      background:
                        candidate === id ? "rgba(37, 99, 235, 0.08)" : "rgba(248, 250, 252, 0.72)",
                    }}
                  >
                    {candidateLabels[id]}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: "8px", color: "#475569", fontSize: "0.94rem" }}>
              <strong style={{ color: "#0f172a" }}>Evaluation lens</strong>
              <span>
                Watch for code weight, transform predictability, camera ergonomics, and export
                clarity.
              </span>
              <span>
                Only the minimal editor contract matters here. No shell/session/provider behavior
                belongs in this lab.
              </span>
            </div>
          </aside>

          <section
            style={{
              minWidth: 0,
              padding: "20px",
              borderRadius: "22px",
              background: "rgba(255, 255, 255, 0.72)",
              boxShadow: "0 10px 26px rgba(15, 23, 42, 0.08)",
            }}
          >
            {candidate === "dom" ? <StageBakeoffDomCandidate /> : null}
            {candidate === "konva" ? <StageBakeoffKonvaCandidate /> : null}
            {candidate === "fabric" ? <StageBakeoffFabricCandidate /> : null}
          </section>
        </section>
      </div>
    </main>
  );
}
