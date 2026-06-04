import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PulseChatHistoryPanel } from "../PulseChatHistoryPanel";

describe("PulseChatHistoryPanel", () => {
  it("renders saved chats and highlights the active thread", () => {
    render(
      <PulseChatHistoryPanel
        threads={[
          {
            threadId: "thread-1",
            title: "First pulse chat",
            presetId: "story_builder",
            presetLabel: "Story Builder",
            updatedAt: "2026-06-03T15:00:00.000Z",
          },
        ]}
        activeThreadId="thread-1"
        loading={false}
        error={null}
        openingThreadId={null}
        onOpenThread={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /First pulse chat/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByText(/Story Builder/i)).toBeInTheDocument();
  });

  it("opens saved threads and hides the new chat entry point", () => {
    const onOpenThread = vi.fn();

    render(
      <PulseChatHistoryPanel
        threads={[
          {
            threadId: "thread-1",
            title: "First pulse chat",
            presetId: "story_builder",
            presetLabel: "Story Builder",
            updatedAt: "2026-06-03T15:00:00.000Z",
          },
        ]}
        activeThreadId={null}
        loading={false}
        error={null}
        openingThreadId={null}
        onOpenThread={onOpenThread}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /First pulse chat/i }));

    expect(screen.queryByRole("button", { name: /New chat/i })).not.toBeInTheDocument();
    expect(onOpenThread).toHaveBeenCalledWith("thread-1");
  });
});
