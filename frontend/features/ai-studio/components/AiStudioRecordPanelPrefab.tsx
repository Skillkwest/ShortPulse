import React from "react";

type AiStudioRecordPanelPrefabProps = {
  panelAriaLabel: string;
  title: string;
  helper: string;
  buttonIdleAriaLabel: string;
  buttonRecordingAriaLabel: string;
  idleCue: string;
  isRecording: boolean;
  isBusy?: boolean;
  statusMessage?: string | null;
  recoveryHint?: string | null;
  isError?: boolean;
  onClick: () => void;
};

export function AiStudioRecordPanelPrefab({
  panelAriaLabel,
  title,
  helper,
  buttonIdleAriaLabel,
  buttonRecordingAriaLabel,
  idleCue,
  isRecording,
  isBusy = false,
  statusMessage = null,
  recoveryHint = null,
  isError = false,
  onClick,
}: AiStudioRecordPanelPrefabProps) {
  return (
    <div className="voices-properties-voice-changer-record-panel" aria-label={panelAriaLabel}>
      <div className="voices-properties-voice-changer-record-panel-copy">
        <p className="voices-properties-voice-changer-record-title">{title}</p>
        <p className="voices-properties-voice-changer-record-helper">{helper}</p>
      </div>
      <div className="voices-properties-voice-changer-record-controls">
        <div className="voices-properties-voice-changer-record-button-wrap">
          <button
            type="button"
            className={`voices-properties-voice-changer-record-btn${
              isRecording ? " is-recording" : ""
            }`}
            aria-label={isRecording ? buttonRecordingAriaLabel : buttonIdleAriaLabel}
            aria-pressed={isRecording}
            disabled={isBusy}
            onClick={onClick}
          >
            <span className="voices-properties-voice-changer-record-btn-core" aria-hidden="true" />
          </button>
        </div>

        <div className="voices-properties-voice-changer-record-footer">
          {statusMessage ? (
            <div className="voices-properties-voice-changer-record-status-stack">
              <p
                className={`voices-properties-voice-changer-record-status-line${
                  isError ? " is-error" : ""
                }`}
                aria-live="polite"
              >
                {statusMessage}
              </p>
              {recoveryHint ? (
                <p className="voices-properties-voice-changer-record-recovery-hint">
                  {recoveryHint}
                </p>
              ) : null}
            </div>
          ) : (
            <span className="voices-properties-voice-changer-record-idle-cue">{idleCue}</span>
          )}
        </div>
      </div>
    </div>
  );
}
