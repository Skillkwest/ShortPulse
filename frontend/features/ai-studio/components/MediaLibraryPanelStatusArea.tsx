/**
 * Media Library panel status area.
 * Hosts error and membership toasts outside of the main panel body component.
 */
import React from "react";
import { CheckCircle } from "phosphor-react";

type MediaLibraryPanelStatusAreaProps = {
  error: string | null;
  membershipPendingMessage: string | null;
  membershipMessage: string | null;
};

/**
 * Renders transient panel status feedback messages.
 */
export const MediaLibraryPanelStatusArea = React.memo(function MediaLibraryPanelStatusArea({
  error,
  membershipPendingMessage,
  membershipMessage,
}: MediaLibraryPanelStatusAreaProps) {
  return (
    <>
      {error ? <p className="tiny subdued">{error}</p> : null}
      {membershipPendingMessage ? (
        <div
          className="media-library-panel-membership-toast is-pending"
          role="status"
          aria-live="polite"
        >
          <div className="reference-spinner media-library-panel-membership-spinner" />
          <span>{membershipPendingMessage}</span>
        </div>
      ) : null}
      {membershipMessage ? (
        <div className="media-library-panel-membership-toast" role="status" aria-live="polite">
          <CheckCircle size={14} weight="fill" aria-hidden />
          <span>{membershipMessage}</span>
        </div>
      ) : null}
    </>
  );
});
