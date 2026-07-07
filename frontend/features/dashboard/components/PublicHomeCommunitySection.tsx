/**
 * Homepage community CTA section shared by signed-out and signed-in dashboard surfaces.
 */
import Link from "next/link";
import { type Ref } from "react";
import { SHORTPULSE_COMMUNITY_LINK_REL, SHORTPULSE_COMMUNITY_LINK_TARGET } from "../communityLinks";

type PublicHomeCommunitySectionProps = {
  communityHref: string;
  isNearViewport?: boolean;
  isPaintPending?: boolean;
  sectionRef?: Ref<HTMLElement>;
};

export function PublicHomeCommunitySection({
  communityHref,
  isNearViewport = true,
  isPaintPending = false,
  sectionRef,
}: PublicHomeCommunitySectionProps) {
  return (
    <section
      ref={sectionRef}
      className={`public-home-orbit${isNearViewport ? "" : " public-home-orbit-idle"}${
        isPaintPending ? " public-home-orbit-paint-pending" : ""
      }`}
      aria-labelledby="public-home-orbit-heading"
    >
      <h2 id="public-home-orbit-heading" className="sr-only">
        Join the ShortPulse community
      </h2>

      <div className="public-home-orbit-simple" aria-label="Join the ShortPulse community">
        <div className="public-home-orbit-simple-mark" aria-hidden="true">
          <span>JOIN THE</span>
          <span>COMMUNITY</span>
        </div>
        <Link
          href={communityHref}
          className="public-home-community-button"
          prefetch={false}
          target={SHORTPULSE_COMMUNITY_LINK_TARGET}
          rel={SHORTPULSE_COMMUNITY_LINK_REL}
        >
          Join Free
        </Link>
      </div>
    </section>
  );
}
