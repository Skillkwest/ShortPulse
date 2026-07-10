import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentComposerAttachmentStrip } from "../AgentComposerAttachmentStrip";

describe("AgentComposerAttachmentStrip", () => {
  it("renders ten attachments with unique accessible removal labels", () => {
    const onRemoveAttachment = vi.fn();
    render(
      <AgentComposerAttachmentStrip
        attachments={Array.from({ length: 10 }, (_, index) => ({
          id: `image-${index + 1}`,
          kind: "image" as const,
          source: "ephemeral_local" as const,
          imageUrl: `https://example.test/${index + 1}.png`,
          modelDataUrl: `https://example.test/${index + 1}.png`,
          deliveryStatus: "ready" as const,
        }))}
        onRemoveAttachment={onRemoveAttachment}
      />
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    const removeLast = screen.getByRole("button", { name: "Remove image 10 of 10" });
    fireEvent.click(removeLast);
    expect(onRemoveAttachment).toHaveBeenCalledWith("image-10");
    expect(screen.getByRole("status")).toHaveTextContent(
      "10 of 10 images ready, 0 preparing, 0 failed."
    );
  });
});
