/**
 * Expert Edit plan CTA tests.
 * Verifies the primary Edit generate slot can become an active subscription CTA.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AI_STUDIO_PLAN_CTA } from "../../../logic/generationAccessCta";
import { ExpertEditPromptComposer } from "../ExpertEditPromptComposer";

describe("ExpertEditPromptComposer generation access CTA", () => {
  it("replaces edit generate with the active plan CTA when generation access is gated", () => {
    const onGenerate = vi.fn();

    render(
      <ExpertEditPromptComposer
        isExpanded
        promptInputShellRef={React.createRef<HTMLDivElement>()}
        promptHighlightRef={React.createRef<HTMLDivElement>()}
        promptTextareaRef={React.createRef<HTMLTextAreaElement>()}
        promptHighlightSegments={[]}
        promptTextValue="Change the background."
        onPromptTextChange={vi.fn()}
        onPromptFocus={vi.fn()}
        onPromptKeyDown={vi.fn()}
        onPromptDrop={vi.fn()}
        onPromptScroll={vi.fn()}
        onPromptBlur={vi.fn()}
        promptTokenPickerState={{ isOpen: false, selectedSlotIndex: null }}
        hostPrimaryImageUrl={null}
        populatedPromptTokenSlotIndexes={[]}
        extraImageUrls={[]}
        onInsertPromptTokenFromPicker={vi.fn()}
        promptTokenInlineError={null}
        onGenerate={onGenerate}
        inlineGenerateDisabled
        generationAccessCta={AI_STUDIO_PLAN_CTA}
      />
    );

    const planCta = screen.getByRole("link", { name: "View subscription plans" });
    expect(planCta).toHaveAttribute("href", "/pricing");
    expect(screen.queryByRole("button", { name: "Generate" })).toBeNull();
    expect(onGenerate).not.toHaveBeenCalled();
  });
});
