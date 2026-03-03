import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { AiStudioSessionsModal } from "../AiStudioSessionsModal";
import type { AiStudioSessionListApiItem } from "../../logic/sessionApiClient";

const createSession = (
  overrides: Partial<AiStudioSessionListApiItem> = {}
): AiStudioSessionListApiItem => ({
  sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
  title: "Session A",
  schemaVersion: 1,
  saveSeq: 3,
  updatedAt: "2026-03-02T01:00:00.000Z",
  expiresAt: "2026-08-29T01:00:00.000Z",
  ...overrides,
});

const createProps = (overrides: Partial<ComponentProps<typeof AiStudioSessionsModal>> = {}) => ({
  isOpen: true,
  currentSessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
  sessions: [createSession()],
  nextCursor: null,
  isLoadingSessions: false,
  isLoadingMoreSessions: false,
  sessionsLoadError: null,
  pendingSessionSwitch: null,
  switchError: null,
  isSwitchingSession: false,
  onClose: vi.fn(),
  onReloadSessions: vi.fn(),
  onLoadMoreSessions: vi.fn(),
  onRequestSessionSwitch: vi.fn(),
  onCancelSessionSwitch: vi.fn(),
  onConfirmSessionSwitch: vi.fn(),
  ...overrides,
});

describe("AiStudioSessionsModal", () => {
  it("renders loading state", () => {
    render(<AiStudioSessionsModal {...createProps({ isLoadingSessions: true, sessions: [] })} />);
    expect(screen.getByText("Loading sessions…")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(<AiStudioSessionsModal {...createProps({ sessions: [] })} />);
    expect(screen.getByText("No previous sessions yet.")).toBeInTheDocument();
  });

  it("renders list state and current session marker", () => {
    render(<AiStudioSessionsModal {...createProps()} />);
    expect(screen.getByText("Session A")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("triggers request switch on selectable row click", () => {
    const onRequestSessionSwitch = vi.fn();
    render(
      <AiStudioSessionsModal
        {...createProps({
          currentSessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
          sessions: [createSession({ sessionId: "a7f45245-f204-4ece-8f9e-c9a66a9d8d2a" })],
          onRequestSessionSwitch,
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Session A/i }));
    expect(onRequestSessionSwitch).toHaveBeenCalledTimes(1);
  });

  it("renders pagination and load-more action", () => {
    const onLoadMoreSessions = vi.fn();
    render(
      <AiStudioSessionsModal
        {...createProps({
          nextCursor: "next-cursor",
          onLoadMoreSessions,
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(onLoadMoreSessions).toHaveBeenCalledTimes(1);
  });

  it("renders retry for load error", () => {
    const onReloadSessions = vi.fn();
    render(
      <AiStudioSessionsModal
        {...createProps({
          sessionsLoadError: "list failed",
          sessions: [],
          onReloadSessions,
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onReloadSessions).toHaveBeenCalledTimes(1);
  });

  it("renders confirm state and triggers confirm/cancel handlers", () => {
    const onCancelSessionSwitch = vi.fn();
    const onConfirmSessionSwitch = vi.fn();
    render(
      <AiStudioSessionsModal
        {...createProps({
          pendingSessionSwitch: createSession({
            sessionId: "a7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
          }),
          onCancelSessionSwitch,
          onConfirmSessionSwitch,
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Save + switch" }));
    expect(onConfirmSessionSwitch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancelSessionSwitch).toHaveBeenCalledTimes(1);
  });
});
