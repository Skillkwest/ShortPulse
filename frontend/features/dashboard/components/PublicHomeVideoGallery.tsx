import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";
import {
  publicHomeGalleryVideoRows,
  type PublicHomeGalleryItem,
} from "../logic/publicHomeGalleryMedia";
import { DashboardModalPortal } from "./DashboardModalPortal";

const GALLERY_VIDEO_SOURCE_ROOT_MARGIN = "360px 0px";

function usePublicHomeGalleryCardViewport(enabled: boolean) {
  const [cardElement, setCardElement] = useState<HTMLElement | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(!enabled);

  useEffect(() => {
    if (!enabled || !cardElement || typeof window === "undefined") return;

    if (!("IntersectionObserver" in window)) {
      const frameId = globalThis.requestAnimationFrame(() => {
        setIsNearViewport(true);
      });
      return () => {
        globalThis.cancelAnimationFrame(frameId);
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsNearViewport(Boolean(entry?.isIntersecting));
      },
      {
        rootMargin: GALLERY_VIDEO_SOURCE_ROOT_MARGIN,
        threshold: 0,
      }
    );

    observer.observe(cardElement);
    return () => {
      observer.disconnect();
    };
  }, [cardElement, enabled]);

  return { isNearViewport, setCardElement };
}

function getGalleryAspectValue(item: PublicHomeGalleryItem) {
  const [width, height] = (item.aspectRatio ?? "1 / 1")
    .split("/")
    .map((part) => Number(part.trim()));
  if (!width || !height) return 1;
  return width / height;
}

function PublicHomeGalleryCard({
  item,
  index,
  onViewPrompt,
  pausePreviewPlayback,
}: {
  item: PublicHomeGalleryItem;
  index: number;
  onViewPrompt: (item: PublicHomeGalleryItem) => void;
  pausePreviewPlayback: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isVideo = item.mediaType === "video";
  const { isNearViewport, setCardElement } = usePublicHomeGalleryCardViewport(isVideo);
  const [hasUserIntent, setHasUserIntent] = useState(false);
  const [wantsPreviewPlayback, setWantsPreviewPlayback] = useState(false);
  const shouldAttachVideoSource = isVideo && (isNearViewport || hasUserIntent);
  const shouldPlayPreview =
    shouldAttachVideoSource && wantsPreviewPlayback && !pausePreviewPlayback;

  const requestPreviewPlayback = useCallback(() => {
    if (!isVideo) return;
    setHasUserIntent(true);
    setWantsPreviewPlayback(true);
  }, [isVideo]);

  const stopPreviewPlayback = useCallback(() => {
    if (!isVideo) return;
    setWantsPreviewPlayback(false);
  }, [isVideo]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !isVideo) return;

    if (!shouldPlayPreview) {
      videoElement.pause();
      if (!wantsPreviewPlayback || pausePreviewPlayback) {
        try {
          videoElement.currentTime = 0;
        } catch {
          // Some browsers disallow seeking until enough data is available.
        }
      }
      return;
    }

    videoElement.muted = true;
    const playPromise = videoElement.play();
    if (playPromise && typeof playPromise.catch === "function") {
      void playPromise.catch(() => {
        // Hover playback is an enhancement; keep the poster visible if the browser blocks it.
      });
    }
  }, [isVideo, pausePreviewPlayback, shouldPlayPreview, wantsPreviewPlayback]);

  useEffect(() => {
    const videoElement = videoRef.current;
    return () => {
      videoElement?.pause();
    };
  }, []);

  const primePreviewFrame = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    if (item.posterSrc || videoElement.currentTime > 0) return;

    try {
      videoElement.currentTime = 0.01;
    } catch {
      // Some browsers block seeking before enough media data is available; hover playback still works.
    }
  }, [item.posterSrc]);

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      if (event.currentTarget.contains(event.relatedTarget)) return;
      stopPreviewPlayback();
    },
    [stopPreviewPlayback]
  );

  return (
    <figure
      ref={setCardElement}
      className={`public-home-gallery-card public-home-gallery-card-${item.size}${
        isVideo ? " public-home-gallery-card-video" : ""
      }`}
      style={
        item.aspectRatio
          ? ({
              "--public-home-gallery-card-aspect": item.aspectRatio,
            } as CSSProperties)
          : undefined
      }
      onBlur={handleBlur}
      onFocus={isVideo ? requestPreviewPlayback : undefined}
      onMouseEnter={isVideo ? requestPreviewPlayback : undefined}
      onMouseLeave={isVideo ? stopPreviewPlayback : undefined}
      onPointerEnter={isVideo ? requestPreviewPlayback : undefined}
      onPointerLeave={isVideo ? stopPreviewPlayback : undefined}
    >
      {isVideo ? (
        <video
          ref={videoRef}
          className="public-home-gallery-media"
          src={shouldAttachVideoSource ? item.src : undefined}
          poster={item.posterSrc}
          muted
          loop
          playsInline
          preload={shouldPlayPreview ? "auto" : shouldAttachVideoSource ? "metadata" : "none"}
          aria-label={item.alt}
          onLoadedMetadata={primePreviewFrame}
        />
      ) : (
        <Image
          className="public-home-gallery-media"
          src={item.src}
          alt={item.alt}
          width={720}
          height={900}
          loading={index < 4 ? "eager" : "lazy"}
          sizes="(min-width: 1280px) 24vw, (min-width: 760px) 33vw, 92vw"
        />
      )}
      <figcaption className="public-home-gallery-caption">
        <p>{item.prompt}</p>
        <button
          type="button"
          className="public-home-gallery-prompt-button"
          onClick={() => onViewPrompt(item)}
        >
          View Prompt
        </button>
      </figcaption>
    </figure>
  );
}

function PublicHomeGalleryPromptModal({
  item,
  isLocked,
  loginHref,
  signupHref,
  onClose,
}: {
  item: PublicHomeGalleryItem | null;
  isLocked: boolean;
  loginHref: string;
  signupHref: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(onClose);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <DashboardModalPortal>
      <div
        {...backdropDismiss}
        className="dashboard-tutorial-modal-backdrop public-home-gallery-prompt-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <section
          className={`dashboard-tutorial-modal public-home-gallery-prompt-modal${
            isLocked ? " public-home-gallery-prompt-modal-locked" : ""
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <header className="dashboard-tutorial-modal-header public-home-gallery-prompt-modal-header">
            <div>
              <p className="eyebrow tiny">Creator Gallery</p>
              <h3 id={titleId}>
                {isLocked ? "You must be logged in to view this prompt" : "Creator prompt"}
              </h3>
            </div>
            <button
              type="button"
              className="icon-btn dashboard-tutorial-modal-close"
              aria-label="Close prompt dialog"
              onClick={onClose}
            >
              <svg
                aria-hidden="true"
                focusable="false"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M6 6l12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2.4"
                />
              </svg>
            </button>
          </header>

          {!isLocked ? (
            <div className="public-home-gallery-prompt-modal-body">
              <p>{item?.prompt}</p>
            </div>
          ) : null}

          {isLocked ? (
            <footer className="dashboard-tutorial-modal-actions public-home-gallery-prompt-actions">
              <Link href={loginHref} className="public-home-gallery-auth-link" prefetch={false}>
                Log in
              </Link>
              <Link
                href={signupHref}
                className="public-home-gallery-auth-link public-home-gallery-auth-link-primary"
                prefetch={false}
              >
                Sign up
              </Link>
            </footer>
          ) : null}
        </section>
      </div>
    </DashboardModalPortal>
  );
}

type PublicHomeVideoGalleryProps = {
  loginHref: string;
  signupHref: string;
  lockPromptsForGuests?: boolean;
  onModalOpenChange?: (isOpen: boolean) => void;
};

export function PublicHomeVideoGallery({
  loginHref,
  signupHref,
  lockPromptsForGuests = false,
  onModalOpenChange,
}: PublicHomeVideoGalleryProps) {
  const [selectedGalleryPrompt, setSelectedGalleryPrompt] = useState<PublicHomeGalleryItem | null>(
    null
  );
  const [isGalleryPromptLocked, setIsGalleryPromptLocked] = useState(false);
  const isPromptModalOpen = selectedGalleryPrompt !== null;

  const handleViewGalleryPrompt = useCallback(
    (item: PublicHomeGalleryItem) => {
      setSelectedGalleryPrompt(item);
      setIsGalleryPromptLocked(lockPromptsForGuests);
    },
    [lockPromptsForGuests]
  );

  const closeGalleryPromptModal = useCallback(() => {
    setSelectedGalleryPrompt(null);
    setIsGalleryPromptLocked(false);
  }, []);

  useEffect(() => {
    onModalOpenChange?.(isPromptModalOpen);
  }, [isPromptModalOpen, onModalOpenChange]);

  return (
    <>
      <section className="public-home-gallery" aria-labelledby="public-home-gallery-heading">
        <div className="public-home-gallery-header">
          <h2 id="public-home-gallery-heading">Video Gallery</h2>
        </div>

        <div className="public-home-gallery-grid">
          {publicHomeGalleryVideoRows.map((row, rowIndex) => (
            <div
              key={`gallery-row-${rowIndex}`}
              className={`public-home-gallery-row public-home-gallery-row-${row.length}`}
              style={
                {
                  "--public-home-gallery-row-template": row
                    .map((item) => `minmax(0, ${getGalleryAspectValue(item)}fr)`)
                    .join(" "),
                } as CSSProperties
              }
            >
              {row.map((item, itemIndex) => (
                <PublicHomeGalleryCard
                  key={`${item.src}-${itemIndex}`}
                  item={item}
                  index={rowIndex * 4 + itemIndex}
                  onViewPrompt={handleViewGalleryPrompt}
                  pausePreviewPlayback={isPromptModalOpen}
                />
              ))}
            </div>
          ))}
        </div>
      </section>

      {selectedGalleryPrompt ? (
        <PublicHomeGalleryPromptModal
          item={selectedGalleryPrompt}
          isLocked={isGalleryPromptLocked}
          loginHref={loginHref}
          signupHref={signupHref}
          onClose={closeGalleryPromptModal}
        />
      ) : null}
    </>
  );
}
