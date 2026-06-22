/**
 * Guest-mode dashboard content.
 * Presents the public dashboard hero and guest CTA card.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { type DashboardTutorial } from "./DashboardTutorialGrid";
import { DashboardTutorialModal } from "./DashboardTutorialModal";
import { dashboardHeroDemoTutorial } from "./dashboardHeroDemoTutorial";
import { PublicHomeCommunitySection } from "./PublicHomeCommunitySection";
import { PublicHomeFooter } from "./PublicHomeFooter";
import { PublicHomeTutorialShowcase } from "./PublicHomeTutorialShowcase";
import { PublicHomeVideoGallery } from "./PublicHomeVideoGallery";
import { buildDashboardAuthPath, buildPricingPath } from "../../pricing/paths";
import { SHORTPULSE_COMMUNITY_URL } from "../communityLinks";

type GuestDashboardViewProps = {
  createProjectHref: string;
  dashboardTutorials: DashboardTutorial[];
};

const modelLogos = [
  { label: "Kling 3.0", markClassName: "model-mark-logo model-mark-kling-logo" },
  { label: "Seedance 2.0", markClassName: "model-mark-logo model-mark-bytedance-logo" },
  { label: "Nano Banana Pro", markClassName: "model-mark-logo model-mark-google-logo" },
  { label: "Nano Banana 2", markClassName: "model-mark-logo model-mark-google-logo" },
  { label: "Seedream 4.5", markClassName: "model-mark-logo model-mark-seedream-logo" },
  { label: "Seedream 5", markClassName: "model-mark-logo model-mark-seedream-logo" },
  { label: "GPT Image 2", markClassName: "model-mark-openai" },
  { label: "Veo 3.1", markClassName: "model-mark-logo model-mark-google-logo" },
  { label: "ElevenLabs", markClassName: "model-mark-logo model-mark-elevenlabs-logo" },
];

const heroBackgroundVideoSrc = "/dashboard/homepage-hero-background-perf.mp4";
const liteHeroBackgroundVideoSrc = "/dashboard/homepage-hero-background-lite.mp4";
const TUTORIAL_AUTOPLAY_BUDGET = 15;
const TUTORIAL_MAX_SIMULTANEOUS_VIDEOS = 15;
const COMPACT_TUTORIAL_MAX_SIMULTANEOUS_VIDEOS = 15;
const COMPACT_LOW_POWER_TUTORIAL_MAX_SIMULTANEOUS_VIDEOS = 15;
const LOW_POWER_TUTORIAL_MAX_SIMULTANEOUS_VIDEOS = 15;
const ORBIT_PAINT_READY_DELAY_MS = 360;
const PAGE_SCROLL_SETTLE_MS = 220;
const HERO_SOURCE_ATTACH_DELAY_MS = 0;
const LITE_HERO_SOURCE_ATTACH_DELAY_MS = 0;

type NavigatorWithPerformanceHints = Navigator & {
  connection?: {
    saveData?: boolean;
  };
  deviceMemory?: number;
};

function shouldUseLiteHomepageMotion() {
  if (typeof window === "undefined") return false;
  const connection = (navigator as NavigatorWithPerformanceHints).connection;
  const deviceMemory = (navigator as NavigatorWithPerformanceHints).deviceMemory;
  const hardwareConcurrency = navigator.hardwareConcurrency;

  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true ||
    window.matchMedia?.("(update: slow)").matches === true ||
    connection?.saveData === true ||
    (typeof hardwareConcurrency === "number" && hardwareConcurrency <= 4) ||
    (typeof deviceMemory === "number" && deviceMemory <= 4)
  );
}

type HomepageMotionLayoutProfile = {
  hasResolved: boolean;
  isCompactLayout: boolean;
  isLiteMotion: boolean;
  isMediumLayout: boolean;
};

function useHomepageMotionLayoutProfile() {
  const [profile, setProfile] = useState<HomepageMotionLayoutProfile>({
    hasResolved: false,
    isCompactLayout: false,
    isLiteMotion: false,
    isMediumLayout: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const compactMediaQuery = window.matchMedia?.("(max-width: 760px)");
    const mediumMediaQuery = window.matchMedia?.("(max-width: 1080px)");
    const reducedMotionMediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const slowUpdateMediaQuery = window.matchMedia?.("(update: slow)");

    const readProfile = (): HomepageMotionLayoutProfile => ({
      hasResolved: true,
      isCompactLayout: compactMediaQuery?.matches ?? false,
      isLiteMotion: shouldUseLiteHomepageMotion(),
      isMediumLayout: mediumMediaQuery?.matches ?? false,
    });
    const updateProfile = () => {
      const nextProfile = readProfile();
      setProfile((currentProfile) =>
        currentProfile.hasResolved === nextProfile.hasResolved &&
        currentProfile.isCompactLayout === nextProfile.isCompactLayout &&
        currentProfile.isLiteMotion === nextProfile.isLiteMotion &&
        currentProfile.isMediumLayout === nextProfile.isMediumLayout
          ? currentProfile
          : nextProfile
      );
    };

    const frameId = globalThis.requestAnimationFrame(updateProfile);
    const mediaQueries = [
      compactMediaQuery,
      mediumMediaQuery,
      reducedMotionMediaQuery,
      slowUpdateMediaQuery,
    ].filter((mediaQuery): mediaQuery is MediaQueryList => Boolean(mediaQuery));

    mediaQueries.forEach((mediaQuery) => {
      mediaQuery.addEventListener?.("change", updateProfile);
    });
    return () => {
      globalThis.cancelAnimationFrame(frameId);
      mediaQueries.forEach((mediaQuery) => {
        mediaQuery.removeEventListener?.("change", updateProfile);
      });
    };
  }, []);

  return profile;
}

type SectionNearViewportOptions = {
  fallbackNearViewport?: boolean;
  initialNearViewport?: boolean;
  rootMargin?: string;
  threshold?: number;
};

function useSectionNearViewport<TElement extends Element>({
  fallbackNearViewport = true,
  initialNearViewport = true,
  rootMargin = "520px 0px",
  threshold = 0.01,
}: SectionNearViewportOptions = {}) {
  const [sectionElement, setSectionElement] = useState<TElement | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(initialNearViewport);
  const [hasBeenNearViewport, setHasBeenNearViewport] = useState(initialNearViewport);
  const sectionRef = useCallback((element: TElement | null) => {
    setSectionElement(element);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sectionElement) return;

    if (!("IntersectionObserver" in window)) {
      const frameId = globalThis.requestAnimationFrame(() => {
        setIsNearViewport(fallbackNearViewport);
        if (fallbackNearViewport) {
          setHasBeenNearViewport(true);
        }
      });
      return () => {
        globalThis.cancelAnimationFrame(frameId);
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const nextIsNearViewport = Boolean(
          entry?.isIntersecting && entry.intersectionRatio >= threshold
        );
        setIsNearViewport((currentIsNearViewport) =>
          currentIsNearViewport === nextIsNearViewport ? currentIsNearViewport : nextIsNearViewport
        );
        if (nextIsNearViewport) {
          setHasBeenNearViewport(true);
        }
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(sectionElement);
    return () => {
      observer.disconnect();
    };
  }, [fallbackNearViewport, rootMargin, sectionElement, threshold]);

  return { hasBeenNearViewport, isNearViewport, sectionRef };
}

function useDocumentVisible() {
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const updateDocumentVisibility = () => {
      setIsDocumentVisible(!document.hidden);
    };

    updateDocumentVisibility();
    document.addEventListener("visibilitychange", updateDocumentVisibility);
    return () => {
      document.removeEventListener("visibilitychange", updateDocumentVisibility);
    };
  }, []);

  return isDocumentVisible;
}

function usePageScrollSettled() {
  const [isPageScrolling, setIsPageScrolling] = useState(false);
  const isPageScrollingRef = useRef(false);
  const scrollSettleTimeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      if (!isPageScrollingRef.current) {
        isPageScrollingRef.current = true;
        setIsPageScrolling(true);
      }
      if (scrollSettleTimeoutRef.current) {
        globalThis.clearTimeout(scrollSettleTimeoutRef.current);
      }
      scrollSettleTimeoutRef.current = globalThis.setTimeout(() => {
        isPageScrollingRef.current = false;
        setIsPageScrolling(false);
        scrollSettleTimeoutRef.current = null;
      }, PAGE_SCROLL_SETTLE_MS);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      isPageScrollingRef.current = false;
      if (scrollSettleTimeoutRef.current) {
        globalThis.clearTimeout(scrollSettleTimeoutRef.current);
      }
    };
  }, []);

  return isPageScrolling;
}

/**
 * Renders the public guest dashboard mode.
 */
export function GuestDashboardView({
  createProjectHref,
  dashboardTutorials,
}: GuestDashboardViewProps) {
  const tutorialLaunchHref = buildPricingPath({ intent: "tutorial" });
  const footerLoginHref = buildDashboardAuthPath();
  const signupHref = buildPricingPath();
  const footerPricingHref = buildPricingPath();
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const motionLayoutProfile = useHomepageMotionLayoutProfile();
  const useLiteMotion = motionLayoutProfile.isLiteMotion;
  const useCompactLayout = motionLayoutProfile.isCompactLayout;
  const isDocumentVisible = useDocumentVisible();
  const isPageScrolling = usePageScrollSettled();
  const [isOrbitPaintReady, setIsOrbitPaintReady] = useState(false);
  const [heroSourceReadySrc, setHeroSourceReadySrc] = useState<string | null>(null);
  const [selectedHeroDemo, setSelectedHeroDemo] = useState<DashboardTutorial | null>(null);
  const [isGalleryPromptModalOpen, setIsGalleryPromptModalOpen] = useState(false);
  const [isTutorialGridModalOpen, setIsTutorialGridModalOpen] = useState(false);
  const { isNearViewport: isHeroNearViewport, sectionRef: heroSectionRef } =
    useSectionNearViewport<HTMLElement>({
      initialNearViewport: false,
      rootMargin: "0px",
      threshold: 0.35,
    });
  const { isNearViewport: isModelsNearViewport, sectionRef: modelsSectionRef } =
    useSectionNearViewport<HTMLElement>({ rootMargin: "180px 0px", threshold: 0.01 });
  const {
    hasBeenNearViewport: hasActivatedTutorialShowcase,
    isNearViewport: isShowcaseNearViewport,
    sectionRef: showcaseSectionRef,
  } = useSectionNearViewport<HTMLElement>({
    fallbackNearViewport: true,
    initialNearViewport: false,
    rootMargin: "120px 0px",
    threshold: 0.01,
  });
  const { isNearViewport: isOrbitNearViewport, sectionRef: orbitSectionRef } =
    useSectionNearViewport<HTMLElement>({
      fallbackNearViewport: false,
      initialNearViewport: false,
      rootMargin: "120px 0px",
      threshold: 0.01,
    });
  const shouldPauseHomeMedia =
    selectedHeroDemo !== null || isGalleryPromptModalOpen || isTutorialGridModalOpen;
  const shouldPauseTutorialPlayback = !isShowcaseNearViewport || shouldPauseHomeMedia;
  const tutorialAutoPlayBudget = Math.min(TUTORIAL_AUTOPLAY_BUDGET, dashboardTutorials.length);
  const tutorialMaxSimultaneousVideos =
    useCompactLayout && useLiteMotion
      ? COMPACT_LOW_POWER_TUTORIAL_MAX_SIMULTANEOUS_VIDEOS
      : useCompactLayout
        ? COMPACT_TUTORIAL_MAX_SIMULTANEOUS_VIDEOS
        : useLiteMotion
          ? LOW_POWER_TUTORIAL_MAX_SIMULTANEOUS_VIDEOS
          : TUTORIAL_MAX_SIMULTANEOUS_VIDEOS;
  const hasResolvedHeroMotionProfile = motionLayoutProfile.hasResolved;
  const selectedHeroBackgroundVideoSrc = hasResolvedHeroMotionProfile
    ? useLiteMotion || useCompactLayout
      ? liteHeroBackgroundVideoSrc
      : heroBackgroundVideoSrc
    : null;
  const activeHeroBackgroundVideoSrc =
    isHeroNearViewport && isDocumentVisible && selectedHeroBackgroundVideoSrc === heroSourceReadySrc
      ? selectedHeroBackgroundVideoSrc
      : null;
  const heroSourceAttachDelayMs =
    useLiteMotion || useCompactLayout
      ? LITE_HERO_SOURCE_ATTACH_DELAY_MS
      : HERO_SOURCE_ATTACH_DELAY_MS;
  const isOrbitPaintPending = isOrbitNearViewport && !isOrbitPaintReady;
  const shouldPauseModelMarquee = !isModelsNearViewport || shouldPauseHomeMedia;
  const handleTutorialGridModalOpenChange = useCallback((isOpen: boolean) => {
    setIsTutorialGridModalOpen(isOpen);
  }, []);
  const handleGalleryPromptModalOpenChange = useCallback((isOpen: boolean) => {
    setIsGalleryPromptModalOpen(isOpen);
  }, []);

  useEffect(() => {
    if (!isHeroNearViewport || !isDocumentVisible || !selectedHeroBackgroundVideoSrc) return;
    if (heroSourceReadySrc === selectedHeroBackgroundVideoSrc) return;

    const timeoutId = globalThis.setTimeout(() => {
      setHeroSourceReadySrc(selectedHeroBackgroundVideoSrc);
    }, heroSourceAttachDelayMs);
    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [
    heroSourceAttachDelayMs,
    heroSourceReadySrc,
    isDocumentVisible,
    isHeroNearViewport,
    selectedHeroBackgroundVideoSrc,
  ]);

  useEffect(() => {
    if (isOrbitPaintReady || !isOrbitNearViewport || isPageScrolling) return;

    const timeoutId = globalThis.setTimeout(() => {
      setIsOrbitPaintReady(true);
    }, ORBIT_PAINT_READY_DELAY_MS);
    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [isOrbitNearViewport, isOrbitPaintReady, isPageScrolling]);

  useEffect(() => {
    const videoElement = heroVideoRef.current;
    if (!videoElement) return;

    if (!isHeroNearViewport || !isDocumentVisible || shouldPauseHomeMedia) {
      videoElement.pause();
      return;
    }

    const frameId = globalThis.requestAnimationFrame(() => {
      const playPromise = videoElement.play();
      if (playPromise && typeof playPromise.catch === "function") {
        void playPromise.catch(() => {
          // Muted autoplay can still be blocked; the poster remains as the fallback.
        });
      }
    });
    return () => {
      globalThis.cancelAnimationFrame(frameId);
    };
  }, [isDocumentVisible, isHeroNearViewport, shouldPauseHomeMedia]);

  return (
    <div className={useLiteMotion ? "public-home-lite-motion" : undefined}>
      <section ref={heroSectionRef} className="dashboard-hero minimal-hero public-home-hero">
        <div className="hero-primary public-home-hero-primary">
          <div className="public-home-hero-bg" aria-hidden="true">
            <video
              ref={heroVideoRef}
              key={activeHeroBackgroundVideoSrc ?? "homepage-hero-poster"}
              className="public-home-hero-video"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            >
              {activeHeroBackgroundVideoSrc ? (
                <source src={activeHeroBackgroundVideoSrc} type="video/mp4" />
              ) : null}
            </video>
          </div>
          <div className="hero-copy public-home-hero-copy">
            <h1>
              A true all-in-one for <span>AI creators.</span>
            </h1>
          </div>

          <h2 id="public-home-models-heading" className="public-home-hero-model-heading">
            The world's best AI models. Thousands of workflows. One simple workspace.{" "}
            <span className="public-home-hero-model-heading-break">Zero frustration.</span>
          </h2>

          <div className="public-home-hero-actions">
            <Link href={createProjectHref} className="public-home-launch-button" prefetch={false}>
              Launch App
            </Link>
            <button
              type="button"
              className="public-home-demo-button"
              onClick={() => setSelectedHeroDemo(dashboardHeroDemoTutorial)}
            >
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      <section
        ref={modelsSectionRef}
        className={`public-home-models${shouldPauseModelMarquee ? " public-home-models-idle" : ""}`}
        aria-labelledby="public-home-models-heading"
      >
        <div className="public-home-model-strip" aria-label="Supported model families">
          {[0, 1, 2, 3].map((loopIndex) => (
            <div
              key={`model-logo-loop-${loopIndex}`}
              className="public-home-model-track"
              aria-hidden={loopIndex > 0}
            >
              {modelLogos.map((modelLogo) => (
                <span key={`${loopIndex}-${modelLogo.label}`} className="public-home-model-logo">
                  <span
                    className={`public-home-model-mark ${modelLogo.markClassName}`}
                    aria-hidden="true"
                  />
                  <span>{modelLogo.label}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      <PublicHomeTutorialShowcase
        tutorials={dashboardTutorials}
        launchHref={tutorialLaunchHref}
        sectionRef={showcaseSectionRef}
        hasActivatedTutorialShowcase={hasActivatedTutorialShowcase}
        autoPlayBudget={tutorialAutoPlayBudget}
        enablePlaybackRotation
        maxSimultaneousVideos={tutorialMaxSimultaneousVideos}
        onModalOpenChange={handleTutorialGridModalOpenChange}
        pauseVideoPlayback={shouldPauseTutorialPlayback}
      />

      <PublicHomeCommunitySection
        communityHref={SHORTPULSE_COMMUNITY_URL}
        sectionRef={orbitSectionRef}
        isNearViewport={isOrbitNearViewport}
        isPaintPending={isOrbitPaintPending}
      />

      <PublicHomeVideoGallery
        loginHref={footerLoginHref}
        signupHref={signupHref}
        lockPromptsForGuests
        onModalOpenChange={handleGalleryPromptModalOpenChange}
      />

      <PublicHomeFooter
        createProjectHref={createProjectHref}
        communityHref={SHORTPULSE_COMMUNITY_URL}
        footerLoginHref={footerLoginHref}
        footerPricingHref={footerPricingHref}
        launchAppLabel="Sign Up"
      />

      {selectedHeroDemo ? (
        <DashboardTutorialModal
          tutorial={selectedHeroDemo}
          launchHref={tutorialLaunchHref}
          onClose={() => setSelectedHeroDemo(null)}
        />
      ) : null}
    </div>
  );
}
