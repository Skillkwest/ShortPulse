/**
 * Account settings section for the profile workspace.
 * Groups identity, security, and AI Studio preference controls into cohesive workspace panels.
 */
import { ProfilePreferenceToggleCard } from "./ProfilePreferenceToggleCard";
import { profileClass } from "../profileRouteStyles";
import { accountStyles, textStyles } from "./profileAccountInlineStyles";

type ProfileAccountSectionProps = {
  displayNameInput: string;
  workspaceEmail: string;
  currentPasswordInput: string;
  pendingWorkspaceEmail: string;
  mediaAutosaveEnabled: boolean;
  mediaAutosaveDisabled: boolean;
  mediaAutosaveSaving: boolean;
  mediaAutosaveError: string | null;
  onDisplayNameInputChange: (value: string) => void;
  onWorkspaceEmailChange: (value: string) => void;
  onCurrentPasswordInputChange: (value: string) => void;
  onProfileSave: () => void;
  onEmailUpdate: () => void;
  onPasswordReset: () => void;
  onMediaAutosaveToggle: (next: boolean) => void;
};

/**
 * Renders the account section panel stack.
 */
export function ProfileAccountSection({
  displayNameInput,
  workspaceEmail,
  currentPasswordInput,
  pendingWorkspaceEmail,
  mediaAutosaveEnabled,
  mediaAutosaveDisabled,
  mediaAutosaveSaving,
  mediaAutosaveError,
  onDisplayNameInputChange,
  onWorkspaceEmailChange,
  onCurrentPasswordInputChange,
  onProfileSave,
  onEmailUpdate,
  onPasswordReset,
  onMediaAutosaveToggle,
}: ProfileAccountSectionProps) {
  return (
    <div
      className={profileClass("profile-section-grid", "profile-account-grid")}
      style={accountStyles.grid}
    >
      <section
        className={profileClass("panel", "profile-panel", "profile-identity-panel")}
        style={accountStyles.panel}
      >
        <div
          className={profileClass("panel-header", "profile-panel-header")}
          style={accountStyles.panelHeader}
        >
          <div>
            <p className="eyebrow" style={textStyles.eyebrow}>
              Identity
            </p>
            <h2 className={profileClass("profile-panel-title")} style={textStyles.h2}>
              Profile
            </h2>
            <p className="subdued tiny" style={textStyles.helper}>
              This name appears in your dashboard.
            </p>
          </div>
        </div>
        <div className={profileClass("profile-field")} style={accountStyles.field}>
          <label htmlFor="display-name" style={textStyles.label}>
            Display name
          </label>
          <input
            id="display-name"
            type="text"
            value={displayNameInput}
            onChange={(event) => onDisplayNameInputChange(event.target.value)}
            className={profileClass("profile-input")}
            style={accountStyles.input}
            placeholder="Your display name"
          />
        </div>
        <div className={profileClass("profile-actions")} style={accountStyles.actions}>
          <button
            type="button"
            className={profileClass("primary-btn", "profile-button")}
            style={accountStyles.button}
            onClick={onProfileSave}
          >
            Save changes
          </button>
        </div>
      </section>

      <section className={profileClass("panel", "profile-panel")} style={accountStyles.panel}>
        <div
          className={profileClass("panel-header", "profile-panel-header")}
          style={accountStyles.panelHeader}
        >
          <div>
            <p className="eyebrow" style={textStyles.eyebrow}>
              Workspace email
            </p>
            <h2 className={profileClass("profile-panel-title")} style={textStyles.h2}>
              Email
            </h2>
            <p className="subdued tiny" style={textStyles.helper}>
              Changes are confirmed by email.
            </p>
          </div>
        </div>
        <div style={accountStyles.fieldStack}>
          <div className={profileClass("profile-field")} style={accountStyles.field}>
            <label htmlFor="workspace-email" style={textStyles.label}>
              Email address
            </label>
            <input
              id="workspace-email"
              type="email"
              value={workspaceEmail}
              onChange={(event) => onWorkspaceEmailChange(event.target.value)}
              className={profileClass("profile-input")}
              style={accountStyles.input}
              placeholder="you@example.com"
            />
          </div>
          <div className={profileClass("profile-field")} style={accountStyles.field}>
            <label htmlFor="workspace-current-password" style={textStyles.label}>
              Current password
            </label>
            <input
              id="workspace-current-password"
              type="password"
              value={currentPasswordInput}
              onChange={(event) => onCurrentPasswordInputChange(event.target.value)}
              className={profileClass("profile-input")}
              style={accountStyles.input}
              autoComplete="current-password"
              placeholder="Enter your current password"
            />
          </div>
        </div>
        {pendingWorkspaceEmail ? (
          <p className="subdued tiny" style={textStyles.helper}>
            Pending confirmation: <strong>{pendingWorkspaceEmail}</strong>
          </p>
        ) : null}
        <div className={profileClass("profile-actions")} style={accountStyles.actions}>
          <button
            type="button"
            className={profileClass("primary-btn", "profile-button")}
            style={accountStyles.button}
            onClick={onEmailUpdate}
          >
            Update email
          </button>
        </div>
      </section>

      <section className={profileClass("panel", "profile-panel")} style={accountStyles.panel}>
        <div
          className={profileClass("panel-header", "profile-panel-header")}
          style={accountStyles.panelHeader}
        >
          <div>
            <p className="eyebrow" style={textStyles.eyebrow}>
              Security
            </p>
            <h2 className={profileClass("profile-panel-title")} style={textStyles.h2}>
              Password reset
            </h2>
            <p className="subdued tiny" style={textStyles.helper}>
              Send a password reset link to your email.
            </p>
          </div>
        </div>
        <div className={profileClass("profile-actions")} style={accountStyles.actions}>
          <button
            type="button"
            className={profileClass("ghost-btn", "profile-button")}
            style={accountStyles.ghostButton}
            onClick={onPasswordReset}
          >
            Send reset link
          </button>
        </div>
      </section>

      <ProfilePreferenceToggleCard
        title="Media Library autosave"
        description="Control whether eligible AI Studio media is automatically saved to your Media Library."
        enabled={mediaAutosaveEnabled}
        disabled={mediaAutosaveDisabled}
        saving={mediaAutosaveSaving}
        error={mediaAutosaveError}
        onToggle={onMediaAutosaveToggle}
        enabledHelperText="Autosave is ON. New eligible AI Studio media will save automatically to your Media Library."
        disabledHelperText="Autosave is OFF. Media Library autosave is disabled, but AI Studio may still keep private restore-safe copies for project continuity."
      />
    </div>
  );
}
