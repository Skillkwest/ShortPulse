/**
 * Dashboard tutorial playback modal.
 * Embeds the selected admin-managed YouTube tutorial before routing into the launch funnel.
 */
import Link from "next/link";
import { useEffect, useId } from "react";
import { ArrowRight, X } from "phosphor-react";
import { AppMessage } from "../../../components/AppMessage";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";
import { resolveYoutubeEmbedUrl } from "../../tutorials/utils/youtubeEmbed";
import type { DashboardTutorial } from "./DashboardTutorialGrid";

type DashboardTutorialModalProps = {
  tutorial: DashboardTutorial;
  launchHref: string;
  onClose: () => void;
};

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
            <X size={18} weight="bold" aria-hidden="true" />
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
          <Link href={launchHref} className="primary-btn dashboard-tutorial-modal-launch">
            <span>Launch AI Studio</span>
            <ArrowRight size={18} weight="bold" aria-hidden="true" />
          </Link>
        </footer>
      </section>
    </div>
  );
}
