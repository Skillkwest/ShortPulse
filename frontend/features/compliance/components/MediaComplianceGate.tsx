/**
 * Full-page protected-route blocker for the one-time media compliance agreement.
 * Keeps the user in a single gated flow until the current agreement version is accepted.
 */
import { useState } from "react";
import Image from "next/image";
import type { MediaComplianceAgreementDefinition } from "../../../lib/compliance/mediaAgreement";

type MediaComplianceGateProps = {
  agreement: MediaComplianceAgreementDefinition;
  error: string | null;
  loading: boolean;
  onAccept: () => Promise<void>;
  onRetry: () => Promise<void>;
};

/**
 * Renders the current media agreement and captures one affirmative acceptance.
 */
export function MediaComplianceGate({
  agreement,
  error,
  loading,
  onAccept,
  onRetry,
}: MediaComplianceGateProps) {
  const [checked, setChecked] = useState(false);
  const helperCopy = checked
    ? "You will only need to do this again if this agreement changes."
    : "Check the box to continue.";

  return (
    <main className="page page-wide compliance-gate-page">
      <div className="panel compliance-gate-panel hero-image-card">
        <div className="compliance-gate-header">
          <div className="compliance-gate-brand" aria-label="ShortPulse">
            <Image
              src="/small good d.png"
              alt="ShortPulse logo"
              className="compliance-gate-brand-logo"
              width={203}
              height={64}
              style={{ height: "auto" }}
              priority
            />
          </div>
          <div className="compliance-gate-meta">
            <p className="eyebrow compliance-gate-eyebrow">Account compliance</p>
            <span className="compliance-gate-badge">One-time step</span>
          </div>
          <h1 className="title compliance-gate-title">{agreement.title}</h1>
          <p className="subdued compliance-gate-intro">{agreement.intro}</p>
        </div>

        <section className="compliance-gate-rules-card" aria-labelledby="media-compliance-rules">
          <div className="compliance-gate-section-header">
            <p id="media-compliance-rules" className="compliance-gate-section-label">
              You agree that
            </p>
            <p className="compliance-gate-section-note">
              These rules apply to images, audio, and video.
            </p>
          </div>
          <ul className="compliance-gate-rules" aria-label="Media agreement rules">
            {agreement.rules.map((rule) => (
              <li key={rule}>
                <span className="compliance-gate-rule-dot" aria-hidden="true" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="compliance-gate-confirm" data-checked={checked ? "true" : "false"}>
          <label className="compliance-gate-checkbox">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              disabled={loading}
            />
            <span>{agreement.checkboxLabel}</span>
          </label>
          <p className="compliance-gate-helper" aria-live="polite">
            {helperCopy}
          </p>
        </div>

        {error ? (
          <div className="auth-error compliance-gate-error" role="alert" aria-live="assertive">
            {error}
          </div>
        ) : null}

        <div className="compliance-gate-actions">
          <button
            type="button"
            className="primary-btn compliance-gate-primary"
            disabled={!checked || loading}
            onClick={() => {
              void onAccept();
            }}
          >
            {loading ? "Saving..." : agreement.confirmLabel}
          </button>
          <button
            type="button"
            className="ghost-btn compliance-gate-secondary"
            disabled={loading}
            onClick={() => {
              void onRetry();
            }}
          >
            Retry
          </button>
        </div>
      </div>
    </main>
  );
}
