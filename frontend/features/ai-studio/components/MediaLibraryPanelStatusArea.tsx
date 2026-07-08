/**
 * Media Library panel status area.
 * Hosts error and membership toasts outside of the main panel body component.
 */
import { useRouter } from "next/router";
import React from "react";
import { AppMessage } from "../../../components/AppMessage";
import { MEDIA_STORAGE_MANAGE_STORAGE_CTA_LABEL } from "../../../lib/mediaStorageQuota";
import { buildProfileSectionHref } from "../../profile/profileNavigation";

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
  const router = useRouter();
  const manageStorageHref = React.useMemo(
    () => buildProfileSectionHref({ section: "storage", fromPath: router.asPath }),
    [router.asPath]
  );

  return (
    <>
      {storageQuotaMessage ? (
        <AppMessage
          className="media-library-panel-membership-toast is-warning"
          tone="warning"
          mode="compact"
          message={storageQuotaMessage}
          action={{
            label: MEDIA_STORAGE_MANAGE_STORAGE_CTA_LABEL,
            href: manageStorageHref,
          }}
        />
      ) : null}
      {error ? <AppMessage tone="error" mode="inline" message={error} /> : null}
      {membershipPendingMessage ? (
        <AppMessage
          className="media-library-panel-membership-toast is-pending"
          tone="info"
          mode="compact"
          message={membershipPendingMessage}
          role="status"
          ariaLive="polite"
          busy
        >
          <span className="media-library-panel-membership-spinner reference-spinner" aria-hidden />
          <span>{membershipPendingMessage}</span>
        </AppMessage>
      ) : null}
      {membershipMessage ? (
        <AppMessage
          className="media-library-panel-membership-toast"
          tone="success"
          mode="compact"
          message={membershipMessage}
          role="status"
          ariaLive="polite"
        />
      ) : null}
    </>
  );
});
