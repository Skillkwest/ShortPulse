/**
 * Shared public-home footer used by logged-out and signed-in dashboard home surfaces.
 */
import Image from "next/image";
import Link from "next/link";

type PublicHomeFooterProps = {
  createProjectHref: string;
  communityHref: string;
  footerLoginHref: string;
  footerPricingHref: string;
  launchAppLabel?: string;
  footerPricingLabel?: string;
  footerLoginLabel?: string;
  communityCtaLabel?: string;
};

/**
 * Renders the canonical ShortPulse homepage footer.
 */
export function PublicHomeFooter({
  createProjectHref,
  communityHref,
  footerLoginHref,
  footerPricingHref,
  launchAppLabel = "Launch App",
  footerPricingLabel = "Pricing",
  footerLoginLabel = "Login",
  communityCtaLabel = "Join Free",
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
            <span className="public-home-footer-logo-name">ShortPulse</span>
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
              {launchAppLabel}
            </Link>
            <Link href={footerPricingHref} prefetch={false}>
              {footerPricingLabel}
            </Link>
            <Link href={footerLoginHref} prefetch={false}>
              {footerLoginLabel}
            </Link>
          </div>
          <div>
            <span>Resources</span>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/refund-policy">Refund Policy</Link>
          </div>
        </nav>

        <div className="public-home-footer-cta">
          <span>Join the community</span>
          <Link href={communityHref} className="public-home-footer-button" prefetch={false}>
            {communityCtaLabel}
          </Link>
        </div>
      </div>

      <div className="public-home-footer-bottom">
        <p>&copy; 2026 ShortPulse.</p>
      </div>
    </footer>
  );
}
