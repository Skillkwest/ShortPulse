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

  it("exposes preparing and failed cards without disabling native removal controls", () => {
    render(
      <AgentComposerAttachmentStrip
        attachments={[
          {
            id: "image-preparing",
            kind: "image",
            source: "ephemeral_local",
            imageUrl: null,
            modelDataUrl: null,
            deliveryStatus: "preparing",
          },
          {
            id: "image-failed",
            kind: "image",
            source: "ephemeral_local",
            imageUrl: "data:image/png;base64,ZmFpbGVk",
            modelDataUrl: null,
            deliveryStatus: "failed",
            deliveryError: "Could not prepare this image.",
          },
        ]}
        onRemoveAttachment={vi.fn()}
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "0 of 2 images ready, 1 preparing, 1 failed."
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveClass("is-preparing");
    expect(items[1]).toHaveClass("is-failed");
    expect(screen.getByRole("button", { name: "Remove image 2 of 2" })).toHaveAttribute(
      "type",
      "button"
    );
  });
});
