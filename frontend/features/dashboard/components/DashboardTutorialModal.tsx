/**
 * Dashboard tutorial playback modal.
 * Embeds the selected admin-managed YouTube tutorial before routing into the launch funnel.
 */
import Link from "next/link";
import { useEffect, useId } from "react";
import { AppMessage } from "../../../components/AppMessage";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";
import { resolveYoutubeEmbedUrl } from "../../tutorials/utils/youtubeEmbed";
import { DashboardModalPortal } from "./DashboardModalPortal";
import type { DashboardTutorial } from "./DashboardTutorialGrid";

type DashboardTutorialModalProps = {
  tutorial: DashboardTutorial;
  launchHref: string;
  onClose: () => void;
};

function TutorialModalCloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TutorialModalArrowIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M5 12h13m-5-5 5 5-5 5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Renders the selected tutorial video and the next-step launch action.
 */
export function DashboardTutorialModal({
  tutorial,
  launchHref,
  onClose,
}: DashboardTutorialModalProps) {
  const titleId = useId();
  const embedUrl = resolveYoutubeEmbedUrl(tutorial.youtubeUrl);
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(onClose);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <DashboardModalPortal>
      <div
        {...backdropDismiss}
        className="dashboard-tutorial-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <section className="dashboard-tutorial-modal" onClick={(event) => event.stopPropagation()}>
          <header className="dashboard-tutorial-modal-header">
            <div>
              <p className="eyebrow tiny">Tutorial hub</p>
              <h3 id={titleId}>{tutorial.title}</h3>
            </div>
            <button
              type="button"
              className="icon-btn dashboard-tutorial-modal-close"
              aria-label="Close tutorial"
              onClick={onClose}
            >
              <TutorialModalCloseIcon size={18} />
            </button>
          </header>

          {embedUrl ? (
            <div className="dashboard-tutorial-modal-video">
              <iframe
                src={embedUrl}
                title={tutorial.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : (
            <AppMessage
              tone="warning"
              mode="inline"
              message="This tutorial video is unavailable right now."
            />
          )}

          <footer className="dashboard-tutorial-modal-actions">
            <Link
              href={launchHref}
              className="primary-btn dashboard-tutorial-modal-launch"
              prefetch={false}
            >
              <span>Open AI Studio</span>
              <TutorialModalArrowIcon size={18} />
            </Link>
          </footer>
        </section>
      </div>
    </DashboardModalPortal>
  );
}
