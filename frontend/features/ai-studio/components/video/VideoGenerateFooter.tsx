/**
 * Video workflow generate footer with summary, warnings, Styles, and Generate CTA.
 */
import React from "react";
import { AppMessage } from "../../../../components/AppMessage";
import { AgentGenerateButton } from "../../../../prefabs/agent";
import { StylesControl } from "../StylesControl";
import type { ExpertEditStyleTile } from "../edit/expertEditStyles";

type VideoGenerateFooterProps = {
  visibleVideoMode: "standard" | "motion" | "lip-sync";
  videoModeSummaryLabel: string;
  shotModeSummaryLabel: string;
  shouldShowKlingReferenceImageWarning: boolean;
  referenceImageWarning: string | null;
  klingPromptGuardrailReason: string | null;
  isGenerateDisabled: boolean;
  guardrailReason: string | null;
  hasRequiredPromptForGenerate: boolean;
  isStylesPanelOpen: boolean;
  selectedStyleId: string | null;
  stylesCatalog?: readonly ExpertEditStyleTile[];
  onStylesPanelToggle?: () => void;
  onRegenerate: () => void;
  costCredits?: number | null;
};

/**
 * Renders the Video footer while preserving the panel-owned Generate decision inputs.
 */
export function VideoGenerateFooter({
  visibleVideoMode,
  videoModeSummaryLabel,
  shotModeSummaryLabel,
  shouldShowKlingReferenceImageWarning,
  referenceImageWarning,
  klingPromptGuardrailReason,
  isGenerateDisabled,
  guardrailReason,
  hasRequiredPromptForGenerate,
  isStylesPanelOpen,
  selectedStyleId,
  stylesCatalog,
  onStylesPanelToggle,
  onRegenerate,
  costCredits,
}: VideoGenerateFooterProps) {
  return (
    <div className="video-right-generate-slot">
      <div className="video-generate-summary-panel" aria-label="Current video settings">
        <div className="video-generate-summary-row">
          <div className="video-generate-summary-item">
            <span className="video-generate-summary-label">Mode</span>
            <span className="video-generate-summary-value">{videoModeSummaryLabel}</span>
          </div>
          {visibleVideoMode === "standard" ? (
            <div className="video-generate-summary-item">
              <span className="video-generate-summary-label">Shot</span>
              <span className="video-generate-summary-value">{shotModeSummaryLabel}</span>
            </div>
          ) : null}
        </div>
      </div>
      {shouldShowKlingReferenceImageWarning ? (
        <AppMessage
          className="video-inline-warning-bubble video-inline-warning-bubble--requirement"
          tone="warning"
          mode="inline"
          message="Add a start frame to generate with Kling"
          role="status"
          ariaLive="polite"
        />
      ) : null}
      {!shouldShowKlingReferenceImageWarning && referenceImageWarning ? (
        <AppMessage
          className="video-inline-warning-bubble"
          tone="warning"
          mode="inline"
          message={referenceImageWarning}
          role="status"
          ariaLive="polite"
        />
      ) : null}
      {!shouldShowKlingReferenceImageWarning &&
      !referenceImageWarning &&
      klingPromptGuardrailReason ? (
        <AppMessage
          className="video-inline-warning-bubble"
          tone="warning"
          mode="inline"
          message={klingPromptGuardrailReason}
          role="status"
          ariaLive="polite"
        />
      ) : null}
      {!shouldShowKlingReferenceImageWarning &&
      !referenceImageWarning &&
      !klingPromptGuardrailReason &&
      isGenerateDisabled &&
      guardrailReason ? (
        <AppMessage
          className="video-inline-warning-bubble"
          tone="warning"
          mode="inline"
          message={guardrailReason}
          role="status"
          ariaLive="polite"
        />
      ) : null}
      <div className="video-right-generate-actions">
        <StylesControl
          isOpen={isStylesPanelOpen}
          selectedStyleId={selectedStyleId}
          styles={stylesCatalog}
          onToggle={onStylesPanelToggle}
          className="video-generate-styles-control"
        />
        <div className="video-right-generate-button">
          <AgentGenerateButton
            onClick={onRegenerate}
            disabled={
              Boolean(klingPromptGuardrailReason) ||
              isGenerateDisabled ||
              !hasRequiredPromptForGenerate ||
              shouldShowKlingReferenceImageWarning
            }
            cost={costCredits}
          />
        </div>
      </div>
    </div>
  );
}
