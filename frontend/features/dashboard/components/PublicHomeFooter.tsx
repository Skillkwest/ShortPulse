/**
 * Shared public-home footer used by logged-out and signed-in dashboard home surfaces.
 */
import Image from "next/image";
import Link from "next/link";
import { useCustomerSupportDialog } from "../../../components/CustomerSupportDialog";
import { CUSTOMER_SUPPORT_LABEL } from "../../../lib/customerSupport";
import { SHORTPULSE_COMMUNITY_LINK_REL, SHORTPULSE_COMMUNITY_LINK_TARGET } from "../communityLinks";

type PublicHomeFooterProps = {
  createProjectHref: string;
  communityHref: string;
  footerLoginHref: string;
  footerPricingHref: string;
  onCreateProjectClick?: () => void;
  launchAppLabel?: string;
  footerPricingLabel?: string;
  footerLoginLabel?: string;
  communityCtaLabel?: string;
  showCustomerSupport?: boolean;
};

/**
 * Renders the canonical ShortPulse homepage footer.
 */
export function PublicHomeFooter({
  createProjectHref,
  communityHref,
  footerLoginHref,
  footerPricingHref,
  onCreateProjectClick,
  launchAppLabel = "Open AI Studio",
  footerPricingLabel = "Pricing",
  footerLoginLabel = "Login",
  communityCtaLabel = "Join Free",
  showCustomerSupport = false,
}: PublicHomeFooterProps) {
  const { customerSupportDialog, openCustomerSupportDialog } = useCustomerSupportDialog();

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
            {onCreateProjectClick ? (
              <button type="button" onClick={onCreateProjectClick}>
                {launchAppLabel}
              </button>
            ) : (
              <Link href={createProjectHref} prefetch={false}>
                {launchAppLabel}
              </Link>
            )}
            <Link href={footerPricingHref} prefetch={false}>
              {footerPricingLabel}
            </Link>
            <Link href={footerLoginHref} prefetch={false}>
              {footerLoginLabel}
            </Link>
          </div>
          <div>
            <span>Resources</span>
            {showCustomerSupport ? (
              <button type="button" onClick={openCustomerSupportDialog}>
                {CUSTOMER_SUPPORT_LABEL}
              </button>
            ) : null}
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/refund-policy">Refund Policy</Link>
          </div>
        </nav>

        <div className="public-home-footer-cta">
          <span>Join the community</span>
          <Link
            href={communityHref}
            className="public-home-footer-button"
            prefetch={false}
            target={SHORTPULSE_COMMUNITY_LINK_TARGET}
            rel={SHORTPULSE_COMMUNITY_LINK_REL}
          >
            {communityCtaLabel}
          </Link>
        </div>
      </div>

      <div className="public-home-footer-bottom">
        <p>&copy; 2026 ShortPulse.</p>
      </div>
      {customerSupportDialog}
    </footer>
  );
}
