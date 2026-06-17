/**
 * Shared public-home footer used by logged-out and signed-in dashboard home surfaces.
 */
import Image from "next/image";
import Link from "next/link";

type PublicHomeFooterProps = {
  createProjectHref: string;
  footerLoginHref: string;
  footerPricingHref: string;
  onWatchDemo: () => void;
};

/**
 * Renders the canonical ShortPulse homepage footer.
 */
export function PublicHomeFooter({
  createProjectHref,
  footerLoginHref,
  footerPricingHref,
  onWatchDemo,
}: PublicHomeFooterProps) {
  return (
    <footer className="public-home-footer" aria-label="ShortPulse footer">
      <div className="public-home-footer-shell">
        <div className="public-home-footer-brand">
          <Link href="/" className="public-home-footer-logo" aria-label="ShortPulse home">
            <Image
              src="/small good d.png"
              alt="ShortPulse"
              width={203}
              height={64}
              style={{ height: "auto" }}
            />
          </Link>
          <p>
            The all-in-one creative engine for images, video, voices, products, ads, and ideas that
            need to move fast.
          </p>
        </div>

        <nav className="public-home-footer-nav" aria-label="Footer navigation">
          <div>
            <span>Start</span>
            <Link href={createProjectHref} prefetch={false}>
              Launch App
            </Link>
            <Link href={footerPricingHref} prefetch={false}>
              Pricing
            </Link>
            <Link href={footerLoginHref} prefetch={false}>
              Login
            </Link>
          </div>
          <div>
            <span>Explore</span>
            <Link href="#public-home-showcase-heading">Workflows</Link>
            <button type="button" onClick={onWatchDemo}>
              Watch Demo
            </button>
            <Link href={createProjectHref} prefetch={false}>
              Join Free
            </Link>
          </div>
        </nav>

        <div className="public-home-footer-cta">
          <span>Built for creators who move before the feed does.</span>
          <Link href={createProjectHref} className="public-home-footer-button" prefetch={false}>
            Join Free
          </Link>
        </div>
      </div>

      <div className="public-home-footer-bottom">
        <p>&copy; 2026 ShortPulse. Create what the internet stops scrolling for.</p>
        <div aria-label="ShortPulse platform highlights">
          <span>Images</span>
          <span>Video</span>
          <span>Voice</span>
          <span>Ads</span>
        </div>
      </div>
    </footer>
  );
}
