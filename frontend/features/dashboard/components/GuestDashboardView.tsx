/**
 * Guest-mode dashboard content.
 * Presents the public dashboard hero and guest CTA card.
 */
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  Article,
  ArrowsClockwise,
  BoundingBox,
  Browsers,
  Camera,
  Cards,
  ChartLineUp,
  Copy,
  Cube,
  Eye,
  FaceMask,
  FileText,
  FilmSlate,
  FilmStrip,
  FrameCorners,
  Headphones,
  ImageSquare,
  MagicWand,
  MaskHappy,
  Microphone,
  MusicNotes,
  Package,
  Palette,
  PaintBrush,
  PencilSimpleLine,
  PenNib,
  Person,
  PersonSimpleRun,
  PresentationChart,
  ShoppingBag,
  SpeakerHigh,
  Sparkle,
  Stack,
  TextT,
  TiktokLogo,
  User,
  UserFocus,
  Users,
  VideoCamera,
  WaveSine,
  type Icon,
} from "phosphor-react";
import { DashboardTutorialGrid, type DashboardTutorial } from "./DashboardTutorialGrid";
import { buildPricingPath } from "../../pricing/paths";

type GuestDashboardViewProps = {
  createProjectHref: string;
  dashboardTutorials: DashboardTutorial[];
};

const modelLogos = [
  { label: "area 2", markClassName: "model-mark-area" },
  { label: "Veo 3.1", markClassName: "model-mark-veo" },
  { label: "Ideogram", markClassName: "model-mark-ideogram" },
  { label: "Runway", markClassName: "model-mark-runway" },
  { label: "Gemini", markClassName: "model-mark-gemini" },
  { label: "Flux", markClassName: "model-mark-flux" },
  { label: "Kling", markClassName: "model-mark-kling" },
];

const heroBackgroundVideoSrc = "/dashboard/homepage-hero-background.mp4";

const orbitTools: Array<{
  label: string;
  Icon: Icon;
  tone: "coral" | "cyan" | "gold" | "violet" | "green";
}> = [
  { label: "Generate Images", Icon: ImageSquare, tone: "coral" },
  { label: "Create Characters", Icon: UserFocus, tone: "cyan" },
  { label: "Create Influencers", Icon: Users, tone: "gold" },
  { label: "Clone Yourself", Icon: Copy, tone: "violet" },
  { label: "Generate Image Prompts", Icon: TextT, tone: "green" },
  { label: "Generate Video Prompts", Icon: FilmStrip, tone: "coral" },
  { label: "Edit Images", Icon: PencilSimpleLine, tone: "cyan" },
  { label: "Create Storyboards", Icon: PresentationChart, tone: "gold" },
  { label: "Digital Try-ons", Icon: ShoppingBag, tone: "violet" },
  { label: "Create Styles", Icon: Palette, tone: "green" },
  { label: "Face Repair", Icon: FaceMask, tone: "coral" },
  { label: "Image to Video", Icon: VideoCamera, tone: "cyan" },
  { label: "End Frames", Icon: FrameCorners, tone: "gold" },
  { label: "Multi-shot Video", Icon: Stack, tone: "violet" },
  { label: "Character Consistency", Icon: Person, tone: "green" },
  { label: "Multi-character", Icon: Cards, tone: "coral" },
  { label: "Clone Voices", Icon: Microphone, tone: "cyan" },
  { label: "Swap Voices", Icon: ArrowsClockwise, tone: "gold" },
  { label: "SFX", Icon: WaveSine, tone: "violet" },
  { label: "VFX", Icon: Sparkle, tone: "green" },
  { label: "Generate Music", Icon: MusicNotes, tone: "coral" },
  { label: "Voice Swap", Icon: SpeakerHigh, tone: "cyan" },
  { label: "Music Videos", Icon: FilmSlate, tone: "gold" },
  { label: "Podcasts", Icon: Headphones, tone: "violet" },
  { label: "Anime Films", Icon: MaskHappy, tone: "green" },
  { label: "Cinematic Films", Icon: Camera, tone: "coral" },
  { label: "Pixar Style Films", Icon: PaintBrush, tone: "cyan" },
  { label: "UGC", Icon: User, tone: "gold" },
  { label: "TikTok Shop", Icon: TiktokLogo, tone: "violet" },
  { label: "Viral Ads", Icon: ChartLineUp, tone: "green" },
  { label: "Product Ads", Icon: Package, tone: "coral" },
  { label: "Character Sheets", Icon: Article, tone: "cyan" },
  { label: "Storyboards", Icon: Browsers, tone: "gold" },
  { label: "Ideation", Icon: MagicWand, tone: "violet" },
  { label: "Viral Skits", Icon: PersonSimpleRun, tone: "green" },
  { label: "Lip Sync", Icon: Microphone, tone: "coral" },
  { label: "Motion Tracking", Icon: BoundingBox, tone: "cyan" },
  { label: "Enhance Realism", Icon: Eye, tone: "gold" },
  { label: "Enhance Skin Texture", Icon: Sparkle, tone: "violet" },
  { label: "Voiceovers", Icon: PenNib, tone: "green" },
  { label: "Generate Scripts", Icon: FileText, tone: "coral" },
  { label: "Product Ads", Icon: Cube, tone: "cyan" },
];

const orbitRadii = [330, 455, 585, 710];
const orbitDurations = [62, 80, 102, 126];

/**
 * Renders the public guest dashboard mode.
 */
export function GuestDashboardView({
  createProjectHref,
  dashboardTutorials,
}: GuestDashboardViewProps) {
  const tutorialLaunchHref = buildPricingPath({ intent: "tutorial" });

  return (
    <>
      <section className="dashboard-hero minimal-hero public-home-hero">
        <div className="hero-primary public-home-hero-primary">
          <div className="public-home-hero-bg" aria-hidden="true">
            <video
              className="public-home-hero-video"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/dashboard/homepage-misty-forest-hero-v1.png"
            >
              <source src={heroBackgroundVideoSrc} type="video/mp4" />
            </video>
          </div>
          <div className="hero-copy public-home-hero-copy">
            <h1>
              A true all-in-one that <span>actually works.</span>
            </h1>
          </div>

          <h2 id="public-home-models-heading" className="public-home-hero-model-heading">
            The top AI models built into the worlds most powerful <span>UX</span>
          </h2>

          <Link href={createProjectHref} className="public-home-launch-button" prefetch={false}>
            Launch App
          </Link>
        </div>
      </section>

      <section className="public-home-models" aria-labelledby="public-home-models-heading">
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

      {dashboardTutorials.length > 0 ? (
        <section className="public-home-showcase" aria-labelledby="public-home-showcase-heading">
          <h2 id="public-home-showcase-heading" className="sr-only">
            Quick-start tutorial workflows
          </h2>
          <DashboardTutorialGrid
            tutorials={dashboardTutorials}
            launchHref={tutorialLaunchHref}
            autoPlayBudget={0}
          />
        </section>
      ) : null}

      <section className="public-home-orbit" aria-labelledby="public-home-orbit-heading">
        <h2 id="public-home-orbit-heading" className="sr-only">
          Shortpulse replaces <span>all these tools.</span>
        </h2>

        <div className="public-home-orbit-backdrop-text" aria-hidden="true">
          <span>CREATE</span>
          <span>ANYTHING</span>
        </div>

        <div className="public-home-orbit-stage" aria-label="Creative tools replaced by ShortPulse">
          <div className="public-home-orbit-ring public-home-orbit-ring-outer" aria-hidden="true" />
          <div
            className="public-home-orbit-ring public-home-orbit-ring-middle"
            aria-hidden="true"
          />
          <div className="public-home-orbit-ring public-home-orbit-ring-inner" aria-hidden="true" />
          <div className="public-home-orbit-core" aria-hidden="true" />
          {orbitTools.map(({ label, Icon, tone }, index) => {
            const ringIndex = index % orbitRadii.length;
            const angle = (index * 137.5 + ringIndex * 10) % 360;
            const duration = orbitDurations[ringIndex];
            const orbitStyle = {
              "--orbit-radius": `${orbitRadii[ringIndex]}px`,
              "--orbit-angle": `${angle}deg`,
              "--orbit-counter-start": `${-angle}deg`,
              "--orbit-counter-end": `${-angle - 360}deg`,
              "--orbit-duration": `${duration}s`,
              "--orbit-depth-delay": `${-(angle / 360) * duration}s`,
            } as CSSProperties;

            return (
              <div
                key={`${label}-${index}`}
                className={`public-home-orbit-path orbit-ring-${ringIndex}`}
                style={orbitStyle}
              >
                <div className={`public-home-orbit-tool orbit-tool-${tone}`}>
                  <span className="public-home-orbit-icon" aria-hidden="true">
                    <Icon size={18} weight="bold" />
                  </span>
                  <span>{label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
