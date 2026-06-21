/**
 * Public legal policy route helpers.
 * Resolves policy page props from the runtime legal policy control plane.
 */
import type { GetServerSideProps } from "next";
import {
  LEGAL_POLICY_SOURCES,
  type LegalPolicySlug,
  type LegalPolicySource,
} from "../data/legalPolicies";
import {
  LegalPolicyUnavailableError,
  resolveLegalPolicyForPublicPage,
} from "../../../lib/server/api/legalPolicyControlPlane";

export type LegalPolicyPageProps = {
  markdown: string;
  policy: LegalPolicySource;
  source?: "control_plane" | "seed";
  version?: number | null;
  updatedAt?: string | null;
  updatedByEmail?: string | null;
  unavailable?: boolean;
};

export function createLegalPolicyServerSideProps(
  slug: LegalPolicySlug
): GetServerSideProps<LegalPolicyPageProps> {
  return async ({ res }) => {
    const policy = LEGAL_POLICY_SOURCES[slug];

    try {
      const resolvedPolicy = await resolveLegalPolicyForPublicPage({ slug });
      return {
        props: {
          markdown: resolvedPolicy.markdown,
          policy,
          source: resolvedPolicy.source,
          version: resolvedPolicy.version,
          updatedAt: resolvedPolicy.updatedAt,
          updatedByEmail: resolvedPolicy.updatedByEmail,
        },
      };
    } catch (error) {
      if (
        error instanceof LegalPolicyUnavailableError ||
        (error instanceof Error && error.name === "LegalPolicyUnavailableError")
      ) {
        res.statusCode = 503;
        return {
          props: {
            markdown:
              "# Legal Policy Temporarily Unavailable\n\nPublication status: Temporarily unavailable\n\nThis policy page is temporarily unavailable. Please try again shortly.",
            policy,
            source: "control_plane",
            version: null,
            updatedAt: null,
            updatedByEmail: null,
            unavailable: true,
          },
        };
      }

      throw error;
    }
  };
}
