/**
 * Shared AI Studio subscription CTA that replaces Generate buttons for known no-plan users.
 */
import React from "react";
import type { GenerationAccessCta } from "../../logic/generationAccessCta";

type GenerationAccessCtaButtonProps = {
  cta: GenerationAccessCta;
  className?: string;
};

/**
 * Renders an active navigation CTA styled as the shared generation-access button.
 */
export function GenerationAccessCtaButton({ cta, className = "" }: GenerationAccessCtaButtonProps) {
  return (
    <a
      className={`ai-generation-access-cta ${className}`.trim()}
      href={cta.href}
      aria-label={cta.ariaLabel}
    >
      <span className="ai-generation-access-cta-label">{cta.label}</span>
    </a>
  );
}
