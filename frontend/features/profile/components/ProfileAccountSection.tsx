/**
 * Account settings section for the profile workspace.
 * Groups identity, billing, security, and AI Studio preference controls into cohesive workspace panels.
 */
import Link from "next/link";
import { CreditCard } from "phosphor-react";
import { ProfilePreferenceToggleCard } from "./ProfilePreferenceToggleCard";
import { profileClass } from "../profileRouteStyles";
import { ProfilePanel } from "./ProfileSurface";

type ProfileAccountSectionProps = {
  displayNameInput: string;
  workspaceEmail: string;
  pendingWorkspaceEmail: string;
  mediaAutosaveEnabled: boolean;
  mediaAutosaveDisabled: boolean;
  mediaAutosaveSaving: boolean;
  mediaAutosaveError: string | null;
  portalActionLabel: string;
  portalLoading: boolean;
  portalManagementAvailable: boolean;
  onDisplayNameInputChange: (value: string) => void;
  onWorkspaceEmailChange: (value: string) => void;
  onProfileSave: () => void;
  onEmailUpdate: () => void;
  onPasswordReset: () => void;
  onMediaAutosaveToggle: (next: boolean) => void;
  onOpenBillingPortal: () => void;
};

/**
 * Renders the account section panel stack.
 */
export function ProfileAccountSection({
  displayNameInput,
  workspaceEmail,
  pendingWorkspaceEmail,
  mediaAutosaveEnabled,
  mediaAutosaveDisabled,
  mediaAutosaveSaving,
  mediaAutosaveError,
  portalActionLabel,
  portalLoading,
  portalManagementAvailable,
  onDisplayNameInputChange,
  onWorkspaceEmailChange,
  onProfileSave,
  onEmailUpdate,
  onPasswordReset,
  onMediaAutosaveToggle,
  onOpenBillingPortal,
}: ProfileAccountSectionProps) {
  return (
    <div className={profileClass("profile-section-grid", "profile-account-grid")}>
      <ProfilePanel eyebrow="Identity" title="Profile" className="profile-identity-panel">
        <div className={profileClass("profile-field")}>
          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            type="text"
            value={displayNameInput}
            onChange={(event) => onDisplayNameInputChange(event.target.value)}
            className={profileClass("profile-input")}
            placeholder="Your display name"
          />
        </div>
        <div className={profileClass("profile-actions")}>
          <button
            type="button"
            className={profileClass("primary-btn", "profile-button")}
            onClick={onProfileSave}
          >
            Save changes
          </button>
        </div>
      </ProfilePanel>

      <ProfilePanel eyebrow="Workspace email" title="Email" className="profile-email-panel">
        <div className={profileClass("profile-field-stack")}>
          <div className={profileClass("profile-field")}>
            <label htmlFor="workspace-email">Email address</label>
            <input
              id="workspace-email"
              type="email"
              value={workspaceEmail}
              onChange={(event) => onWorkspaceEmailChange(event.target.value)}
              className={profileClass("profile-input")}
              placeholder="you@example.com"
            />
          </div>
        </div>
        {pendingWorkspaceEmail ? (
          <p className="subdued tiny">
            Pending confirmation: <strong>{pendingWorkspaceEmail}</strong>
          </p>
        ) : null}
        <div className={profileClass("profile-actions")}>
          <button
            type="button"
            className={profileClass("primary-btn", "profile-button")}
            onClick={onEmailUpdate}
          >
            Update email
          </button>
        </div>
      </ProfilePanel>

      <ProfilePanel
        id="billing"
        eyebrow="Billing"
        title="Payment details"
        icon={CreditCard}
        className="profile-billing-panel"
      >
        <div className={profileClass("profile-actions")}>
          <Link
            href="/profile?section=subscription"
            className={profileClass(
              "profile-button",
              portalManagementAvailable ? "ghost-btn" : "primary-btn"
            )}
          >
            Manage subscription
          </Link>
          {portalManagementAvailable ? (
            <button
              type="button"
              className={profileClass("profile-button", "primary-btn")}
              onClick={onOpenBillingPortal}
              disabled={portalLoading}
            >
              {portalLoading ? "Opening secure portal…" : portalActionLabel}
            </button>
          ) : null}
        </div>
      </ProfilePanel>

      <ProfilePanel eyebrow="Security" title="Password reset" className="profile-security-panel">
        <div className={profileClass("profile-actions")}>
          <button
            type="button"
            className={profileClass("ghost-btn", "profile-button")}
            onClick={onPasswordReset}
          >
            Send reset link
          </button>
        </div>
      </ProfilePanel>

      <ProfilePreferenceToggleCard
        title="Media Library autosave"
        enabled={mediaAutosaveEnabled}
        disabled={mediaAutosaveDisabled}
        saving={mediaAutosaveSaving}
        error={mediaAutosaveError}
        onToggle={onMediaAutosaveToggle}
      />
    </div>
  );
}
