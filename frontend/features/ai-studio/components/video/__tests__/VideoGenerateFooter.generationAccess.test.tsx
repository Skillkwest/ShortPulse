/**
 * Video generate footer plan CTA tests.
 * Verifies the primary Video generate slot can become an active subscription CTA.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AI_STUDIO_PLAN_CTA } from "../../../logic/generationAccessCta";
import { VideoGenerateFooter } from "../VideoGenerateFooter";

describe("VideoGenerateFooter generation access CTA", () => {
  it("replaces video generate with the active plan CTA when generation access is gated", () => {
    const onRegenerate = vi.fn();

    render(
      <VideoGenerateFooter
        visibleVideoMode="standard"
        videoModeSummaryLabel="Standard"
        shotModeSummaryLabel="Single"
        shouldShowKlingReferenceImageWarning={false}
        referenceImageWarning={null}
        klingPromptGuardrailReason={null}
        isGenerateDisabled
        guardrailReason="Add a prompt."
        hasRequiredPromptForGenerate={false}
        isStylesPanelOpen={false}
        selectedStyleId={null}
        onRegenerate={onRegenerate}
        generationAccessCta={AI_STUDIO_PLAN_CTA}
      />
    );

    const planCta = screen.getByRole("link", { name: "View subscription plans" });
    expect(planCta).toHaveAttribute("href", "/pricing");
    expect(screen.queryByRole("button", { name: "Generate" })).toBeNull();
    expect(onRegenerate).not.toHaveBeenCalled();
  });
});
