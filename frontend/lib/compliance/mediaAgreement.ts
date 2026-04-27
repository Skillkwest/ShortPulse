/**
 * Shared media-compliance agreement definition.
 * Keeps the current key, version, and user-facing copy in one place for client/server use.
 */

export type MediaComplianceAgreementDefinition = {
  key: string;
  version: string;
  title: string;
  intro: string;
  rules: string[];
  checkboxLabel: string;
  confirmLabel: string;
};

export type MediaComplianceStatusResponse = {
  agreement: MediaComplianceAgreementDefinition;
  accepted: boolean;
  acceptedAt: string | null;
};

/**
 * Current versioned media-compliance agreement enforced for protected routes.
 */
export const MEDIA_COMPLIANCE_AGREEMENT: MediaComplianceAgreementDefinition = {
  key: "media_usage_compliance",
  version: "2026-04-25",
  title: "Confirm media rights",
  intro:
    "Before you continue, confirm that any images, audio, or video you use in ShortPulse follow these rules.",
  rules: [
    "I own this media or have permission to use it in ShortPulse.",
    "If real people appear in it, I have any consent needed to use it.",
    "If minors appear in it, I have any required parent or guardian permission.",
    "I will not use ShortPulse to violate rights, impersonate, deceive, or exploit anyone.",
  ],
  checkboxLabel: "I confirm that the media I use in ShortPulse follows these rules.",
  confirmLabel: "Continue",
};
