/**
 * Media Library panel status area.
 * Hosts error and membership toasts outside of the main panel body component.
 */
import React from "react";
import { CheckCircle } from "phosphor-react";
import {
  MEDIA_STORAGE_MANAGE_STORAGE_CTA_HREF,
  MEDIA_STORAGE_MANAGE_STORAGE_CTA_LABEL,
} from "../../../lib/mediaStorageQuota";

type MediaLibraryPanelStatusAreaProps = {
  error: string | null;
  membershipPendingMessage: string | null;
  membershipMessage: string | null;
  storageQuotaMessage?: string | null;
};

/**
 * Renders transient panel status feedback messages.
 */
export const MediaLibraryPanelStatusArea = React.memo(function MediaLibraryPanelStatusArea({
  error,
  membershipPendingMessage,
  membershipMessage,
  storageQuotaMessage = null,
}: MediaLibraryPanelStatusAreaProps) {
  return (
    <>
      {storageQuotaMessage ? (
        <div className="media-library-panel-membership-toast is-warning" role="alert">
          <span>{storageQuotaMessage}</span>
          <a href={MEDIA_STORAGE_MANAGE_STORAGE_CTA_HREF}>
            {MEDIA_STORAGE_MANAGE_STORAGE_CTA_LABEL}
          </a>
        </div>
      ) : null}
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
