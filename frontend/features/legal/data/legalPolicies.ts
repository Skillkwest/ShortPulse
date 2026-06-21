/**
 * Legal policy route metadata.
 * Defines the stable public slugs and seed file names for ShortPulse policy documents.
 */
export type LegalPolicySlug = "terms" | "privacy" | "refund-policy";

export type LegalPolicySource = {
  slug: LegalPolicySlug;
  routePath: string;
  title: string;
  documentTitle: string;
  description: string;
  contentFileName: string;
};

export const LEGAL_POLICY_SOURCES: Record<LegalPolicySlug, LegalPolicySource> = {
  terms: {
    slug: "terms",
    routePath: "/terms",
    title: "ShortPulse Terms of Service",
    documentTitle: "ShortPulse Terms of Service",
    description: "ShortPulse Terms of Service for account, billing, content, and AI Studio use.",
    contentFileName: "terms.md",
  },
  privacy: {
    slug: "privacy",
    routePath: "/privacy",
    title: "ShortPulse Privacy Policy",
    documentTitle: "ShortPulse Privacy Policy",
    description:
      "ShortPulse Privacy Policy for data collection, use, sharing, retention, and rights.",
    contentFileName: "privacy.md",
  },
  "refund-policy": {
    slug: "refund-policy",
    routePath: "/refund-policy",
    title: "ShortPulse Refund Policy",
    documentTitle: "ShortPulse Refund Policy",
    description:
      "ShortPulse Refund Policy for subscriptions, credits, storage add-ons, and billing disputes.",
    contentFileName: "refund-policy.md",
  },
};

export const LEGAL_POLICY_NAV_ITEMS = [
  LEGAL_POLICY_SOURCES.terms,
  LEGAL_POLICY_SOURCES.privacy,
  LEGAL_POLICY_SOURCES["refund-policy"],
];

export const LEGAL_POLICY_SLUGS = Object.keys(LEGAL_POLICY_SOURCES) as LegalPolicySlug[];

/**
 * Validate user or route input before it can address a legal policy document.
 */
export const isLegalPolicySlug = (value: unknown): value is LegalPolicySlug =>
  typeof value === "string" && value in LEGAL_POLICY_SOURCES;
