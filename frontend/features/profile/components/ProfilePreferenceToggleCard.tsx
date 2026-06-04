/**
 * Reusable profile preference card for a single boolean toggle setting.
 * Receives state and handlers from the page and renders profile-aligned UI.
 */
import { profileClass } from "../profileRouteStyles";
import { accountStyles, textStyles } from "./profileAccountInlineStyles";

type ProfilePreferenceToggleCardProps = {
  title: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  saving?: boolean;
  error?: string | null;
  onToggle: (next: boolean) => void;
  enabledHelperText: string;
  disabledHelperText: string;
};

/**
 * Presentational card that renders copy, helper text, sync status, and a toggle switch.
 */
export function ProfilePreferenceToggleCard({
  title,
  description,
  enabled,
  disabled = false,
  saving = false,
  error = null,
  onToggle,
  enabledHelperText,
  disabledHelperText,
}: ProfilePreferenceToggleCardProps) {
  return (
    <div
      className={profileClass("profile-card", "profile-preference-card")}
      style={accountStyles.preference}
    >
      <div className={profileClass("profile-preference-row")} style={accountStyles.preferenceRow}>
        <div
          className={profileClass("profile-preference-copy")}
          style={accountStyles.preferenceCopy}
        >
          <h3 style={textStyles.h3}>{title}</h3>
          <p className="tiny subdued" style={textStyles.helper}>
            {description}
          </p>
        </div>
        <button
          type="button"
          className={profileClass(
            "reference-toggle",
            "profile-preference-toggle",
            enabled && "is-active"
          )}
          style={{
            ...accountStyles.switchButton,
            ...(enabled ? accountStyles.switchButtonActive : null),
            opacity: disabled ? 0.6 : 1,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
          aria-pressed={enabled}
          aria-label={enabled ? `Disable ${title}` : `Enable ${title}`}
          onClick={() => onToggle(!enabled)}
          disabled={disabled}
        >
          <span
            className={profileClass("reference-toggle-track")}
            aria-hidden="true"
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: enabled ? "flex-end" : "flex-start",
              alignItems: "center",
            }}
          >
            <span
              className={profileClass("reference-toggle-dot")}
              style={accountStyles.switchDot}
            />
          </span>
        </button>
      </div>
      <p
        className={profileClass("tiny", "subdued", "profile-preference-helper")}
        style={textStyles.helper}
      >
        {enabled ? enabledHelperText : disabledHelperText}
      </p>
      {saving ? (
        <p
          className={profileClass("tiny", "profile-preference-status")}
          style={accountStyles.status}
          role="status"
        >
          Saving autosave preference...
        </p>
      ) : null}
      {error ? (
        <p
          className={profileClass(
            "tiny",
            "profile-preference-status",
            "profile-preference-status-error"
          )}
          style={{ ...accountStyles.status, ...accountStyles.statusError }}
          role="status"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
