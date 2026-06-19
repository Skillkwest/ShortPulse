import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PulseChatHistoryPanel } from "../PulseChatHistoryPanel";
import type { PulseChatThreadListItem } from "../../../pulseChats/pulseChatThread";

const buildThread = (index: number): PulseChatThreadListItem => ({
  threadId: `thread-${index}`,
  title: `Pulse chat ${index}`,
  titleSource: "auto",
  presetId: index % 2 === 0 ? "single_shot" : "multi_shot",
  presetLabel: index % 2 === 0 ? "Single Shot Video" : "Multi Shot Video",
  updatedAt: `2026-06-${String(index).padStart(2, "0")}T15:00:00.000Z`,
});

describe("PulseChatHistoryPanel", () => {
  it("renders saved chats and highlights the active thread", () => {
    render(
      <PulseChatHistoryPanel
        threads={[
          {
            threadId: "thread-1",
            title: "First pulse chat",
            titleSource: "auto",
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
        onRenameThread={vi.fn()}
        onDeleteThread={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /First pulse chat/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByText(/Story Builder/i)).toBeInTheDocument();
    expect(screen.getByText(/Jun 3/i)).toBeInTheDocument();
  });

  it("opens saved threads and hides the new chat entry point", () => {
    const onOpenThread = vi.fn();

    render(
      <PulseChatHistoryPanel
        threads={[
          {
            threadId: "thread-1",
            title: "First pulse chat",
            titleSource: "auto",
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
        onRenameThread={vi.fn()}
        onDeleteThread={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /First pulse chat/i }));

    expect(screen.queryByRole("button", { name: /New chat/i })).not.toBeInTheDocument();
    expect(onOpenThread).toHaveBeenCalledWith("thread-1");
  });

  it("caps the rail and exposes all saved chats from the full list", () => {
    const threads = Array.from({ length: 8 }, (_, index) => buildThread(index + 1));

    render(
      <PulseChatHistoryPanel
        threads={threads}
        activeThreadId={null}
        loading={false}
        error={null}
        openingThreadId={null}
        onOpenThread={vi.fn()}
        onRenameThread={vi.fn()}
        onDeleteThread={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /Pulse chat 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pulse chat 6/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pulse chat 7/i })).not.toBeInTheDocument();
    expect(screen.getByText("See more chats")).toBeInTheDocument();

    fireEvent.click(screen.getByText("See more chats"));

    const dialog = screen.getByRole("dialog", { name: /All Pulse chats/i });
    for (const thread of threads) {
      expect(
        within(dialog).getByRole("button", { name: new RegExp(thread.title, "i") })
      ).toBeInTheDocument();
    }
  });

  it("keeps an older active thread visible while capping newest chats", () => {
    const threads = Array.from({ length: 8 }, (_, index) => buildThread(index + 1));

    render(
      <PulseChatHistoryPanel
        threads={threads}
        activeThreadId="thread-8"
        loading={false}
        error={null}
        openingThreadId={null}
        onOpenThread={vi.fn()}
        onRenameThread={vi.fn()}
        onDeleteThread={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /Pulse chat 1/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pulse chat 6/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pulse chat 8/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("opens chats from the full list through the existing reopen handler", () => {
    const threads = Array.from({ length: 8 }, (_, index) => buildThread(index + 1));
    const onOpenThread = vi.fn();

    render(
      <PulseChatHistoryPanel
        threads={threads}
        activeThreadId={null}
        loading={false}
        error={null}
        openingThreadId={null}
        onOpenThread={onOpenThread}
        onRenameThread={vi.fn()}
        onDeleteThread={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("See more chats"));
    const dialog = screen.getByRole("dialog", { name: /All Pulse chats/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /Pulse chat 8/i }));

    expect(onOpenThread).toHaveBeenCalledWith("thread-8");
    expect(screen.queryByRole("dialog", { name: /All Pulse chats/i })).not.toBeInTheDocument();
  });

  it("opens a right-click rename menu and commits an inline title edit", () => {
    const onRenameThread = vi.fn();

    render(
      <PulseChatHistoryPanel
        threads={[
          {
            threadId: "thread-1",
            title: "First pulse chat",
            titleSource: "auto",
            presetId: "story_builder",
            presetLabel: "Story Builder",
            updatedAt: "2026-06-03T15:00:00.000Z",
          },
        ]}
        activeThreadId={null}
        loading={false}
        error={null}
        openingThreadId={null}
        onOpenThread={vi.fn()}
        onRenameThread={onRenameThread}
        onDeleteThread={vi.fn()}
      />
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: /First pulse chat/i }), {
      clientX: 120,
      clientY: 220,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: /Rename/i }));

    const renameInput = screen.getByLabelText("Rename First pulse chat");
    fireEvent.change(renameInput, { target: { value: "Launch hook pass" } });
    fireEvent.keyDown(renameInput, { key: "Enter" });

    expect(onRenameThread).toHaveBeenCalledWith("thread-1", "Launch hook pass");
    expect(
      screen.queryByRole("menu", { name: /First pulse chat chat actions/i })
    ).not.toBeInTheDocument();
  });

  it("opens a right-click menu and deletes a saved chat", () => {
    const onDeleteThread = vi.fn();

    render(
      <PulseChatHistoryPanel
        threads={[
          {
            threadId: "thread-1",
            title: "First pulse chat",
            titleSource: "auto",
            presetId: "story_builder",
            presetLabel: "Story Builder",
            updatedAt: "2026-06-03T15:00:00.000Z",
          },
        ]}
        activeThreadId={null}
        loading={false}
        error={null}
        openingThreadId={null}
        onOpenThread={vi.fn()}
        onRenameThread={vi.fn()}
        onDeleteThread={onDeleteThread}
      />
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: /First pulse chat/i }), {
      clientX: 120,
      clientY: 220,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: /Delete/i }));

    expect(onDeleteThread).toHaveBeenCalledWith("thread-1");
    expect(
      screen.queryByRole("menu", { name: /First pulse chat chat actions/i })
    ).not.toBeInTheDocument();
  });
});
