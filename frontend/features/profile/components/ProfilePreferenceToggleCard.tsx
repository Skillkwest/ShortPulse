/**
 * Reusable profile preference card for a single boolean toggle setting.
 * Receives state and handlers from the page and renders profile-aligned UI.
 */
import { AppMessage } from "../../../components/AppMessage";
import { profileClass } from "../profileRouteStyles";

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
    <div className={profileClass("profile-card", "profile-preference-card")}>
      <div className={profileClass("profile-preference-row")}>
        <div className={profileClass("profile-preference-copy")}>
          <h3>{title}</h3>
          <p className="tiny subdued">{description}</p>
        </div>
        <button
          type="button"
          className={profileClass(
            "reference-toggle",
            "profile-preference-toggle",
            enabled && "is-active"
          )}
          aria-pressed={enabled}
          aria-label={enabled ? `Disable ${title}` : `Enable ${title}`}
          onClick={() => onToggle(!enabled)}
          disabled={disabled}
        >
          <span className={profileClass("reference-toggle-track")} aria-hidden="true">
            <span className={profileClass("reference-toggle-dot")} />
          </span>
        </button>
      </div>
      <p className={profileClass("tiny", "subdued", "profile-preference-helper")}>
        {enabled ? enabledHelperText : disabledHelperText}
      </p>
      {saving ? (
        <p className={profileClass("tiny", "profile-preference-status")} role="status">
          Saving autosave preference...
        </p>
      ) : null}
      {error ? (
        <AppMessage
          className={profileClass(
            "tiny",
            "profile-preference-status",
            "profile-preference-status-error"
          )}
          tone="error"
          mode="inline"
          message={error}
        />
      ) : null}
    </div>
  );
}
