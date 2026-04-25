/**
 * Account settings section for the profile workspace.
 * Groups identity, security, and AI Studio preference controls into cohesive workspace panels.
 */
import { ProfilePreferenceToggleCard } from "./ProfilePreferenceToggleCard";

type ProfileAccountSectionProps = {
  displayNameInput: string;
  workspaceEmail: string;
  mediaAutosaveEnabled: boolean;
  mediaAutosaveDisabled: boolean;
  mediaAutosaveSaving: boolean;
  mediaAutosaveError: string | null;
  onDisplayNameInputChange: (value: string) => void;
  onWorkspaceEmailChange: (value: string) => void;
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
  mediaAutosaveEnabled,
  mediaAutosaveDisabled,
  mediaAutosaveSaving,
  mediaAutosaveError,
  onDisplayNameInputChange,
  onWorkspaceEmailChange,
  onProfileSave,
  onEmailUpdate,
  onPasswordReset,
  onMediaAutosaveToggle,
}: ProfileAccountSectionProps) {
  return (
    <div className="profile-section-grid">
      <section className="panel profile-panel">
        <div className="panel-header profile-panel-header">
          <div>
            <p className="eyebrow">Identity</p>
            <h2 className="profile-panel-title">Profile</h2>
            <p className="subdued tiny">This name appears in your dashboard and workspace views.</p>
          </div>
        </div>
        <div className="profile-field">
          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            type="text"
            value={displayNameInput}
            onChange={(event) => onDisplayNameInputChange(event.target.value)}
            className="profile-input"
            placeholder="Your display name"
          />
        </div>
        <div className="profile-actions">
          <button type="button" className="primary-btn profile-button" onClick={onProfileSave}>
            Save changes
          </button>
        </div>
      </section>

      <section className="panel profile-panel">
        <div className="panel-header profile-panel-header">
          <div>
            <p className="eyebrow">Workspace email</p>
            <h2 className="profile-panel-title">Email</h2>
            <p className="subdued tiny">Changes are confirmed by email.</p>
          </div>
        </div>
        <div className="profile-field">
          <label htmlFor="workspace-email">Email address</label>
          <input
            id="workspace-email"
            type="email"
            value={workspaceEmail}
            onChange={(event) => onWorkspaceEmailChange(event.target.value)}
            className="profile-input"
            placeholder="you@example.com"
          />
        </div>
        <div className="profile-actions">
          <button type="button" className="primary-btn profile-button" onClick={onEmailUpdate}>
            Update email
          </button>
        </div>
      </section>

      <section className="panel profile-panel">
        <div className="panel-header profile-panel-header">
          <div>
            <p className="eyebrow">Security</p>
            <h2 className="profile-panel-title">Password reset</h2>
            <p className="subdued tiny">Send a password reset link to your email.</p>
          </div>
        </div>
        <div className="profile-actions">
          <button type="button" className="ghost-btn profile-button" onClick={onPasswordReset}>
            Send reset link
          </button>
        </div>
      </section>

      <ProfilePreferenceToggleCard
        title="AI Studio autosave"
        description="Control whether eligible generated and reference media are automatically saved to your Media Library."
        enabled={mediaAutosaveEnabled}
        disabled={mediaAutosaveDisabled}
        saving={mediaAutosaveSaving}
        error={mediaAutosaveError}
        onToggle={onMediaAutosaveToggle}
        enabledHelperText="Autosave is ON. New eligible AI Studio media will save automatically."
        disabledHelperText="Autosave is OFF. You can still save media manually from AI Studio."
      />
    </div>
  );
}
