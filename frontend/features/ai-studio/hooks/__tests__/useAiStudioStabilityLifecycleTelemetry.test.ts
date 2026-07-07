import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  installAiStudioCrashEvidenceHandle,
  reportAiStudioStabilityEvent,
} from "../../logic/aiStudioStabilityTelemetry";
import { useAiStudioStabilityLifecycleTelemetry } from "../useAiStudioStabilityLifecycleTelemetry";

vi.mock("../../logic/aiStudioStabilityTelemetry", () => ({
  installAiStudioCrashEvidenceHandle: vi.fn(() => vi.fn()),
  reportAiStudioStabilityEvent: vi.fn(),
}));

const installAiStudioCrashEvidenceHandleMock = vi.mocked(installAiStudioCrashEvidenceHandle);
const reportAiStudioStabilityEventMock = vi.mocked(reportAiStudioStabilityEvent);

const setVisibilityState = (visibilityState: DocumentVisibilityState) => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibilityState,
  });
};

const dispatchPageTransitionEvent = (type: "pagehide" | "pageshow", persisted: boolean) => {
  const event = new Event(type);
  Object.defineProperty(event, "persisted", {
    configurable: true,
    value: persisted,
  });
  window.dispatchEvent(event);
};

const clearLifecycleWindowState = () => {
  delete window.__shortpulseAiStudioLifecycleDocumentState;
};

describe("useAiStudioStabilityLifecycleTelemetry", () => {
  beforeEach(() => {
    installAiStudioCrashEvidenceHandleMock.mockClear();
    reportAiStudioStabilityEventMock.mockClear();
    clearLifecycleWindowState();
    window.sessionStorage.clear();
    setVisibilityState("visible");
  });

  it("reports startup with document-level reload diagnostics and no content fields", () => {
    renderHook(() =>
      useAiStudioStabilityLifecycleTelemetry({
        projectId: "project-123",
        projectRouteRequested: true,
      })
    );

    expect(reportAiStudioStabilityEventMock).toHaveBeenCalledWith(
      "session_started",
      expect.objectContaining({
        project_id_present: true,
        project_route_requested: true,
        lifecycle_document_id: expect.any(String),
        previous_lifecycle_document_id_present: false,
        lifecycle_document_replaced: false,
        lifecycle_event_index: 1,
        visibility_state: "visible",
      })
    );
    expect(JSON.stringify(reportAiStudioStabilityEventMock.mock.calls)).not.toContain(
      "project-123"
    );
    expect(installAiStudioCrashEvidenceHandleMock).toHaveBeenCalledTimes(1);
  });

  it("reports visible return, page transition, and focus breadcrumbs without unload listeners", () => {
    renderHook(() =>
      useAiStudioStabilityLifecycleTelemetry({
        projectId: null,
        projectRouteRequested: false,
      })
    );
    reportAiStudioStabilityEventMock.mockClear();

    act(() => {
      setVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(reportAiStudioStabilityEventMock).toHaveBeenCalledWith(
      "visibility_hidden",
      expect.objectContaining({
        lifecycle_event_index: 2,
        visibility_state: "hidden",
      })
    );

    act(() => {
      setVisibilityState("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(reportAiStudioStabilityEventMock).toHaveBeenCalledWith(
      "visibility_visible",
      expect.objectContaining({
        lifecycle_event_index: 3,
        visibility_state: "visible",
      })
    );

    act(() => {
      dispatchPageTransitionEvent("pagehide", true);
      dispatchPageTransitionEvent("pageshow", true);
      window.dispatchEvent(new Event("beforeunload"));
      window.dispatchEvent(new Event("unload"));
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
    });

    expect(reportAiStudioStabilityEventMock).toHaveBeenCalledWith(
      "pagehide",
      expect.objectContaining({ pagehide_persisted: true })
    );
    expect(reportAiStudioStabilityEventMock).toHaveBeenCalledWith(
      "pageshow",
      expect.objectContaining({ pageshow_persisted: true })
    );
    expect(reportAiStudioStabilityEventMock).not.toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Object)
    );
    expect(reportAiStudioStabilityEventMock).not.toHaveBeenCalledWith("unload", expect.any(Object));
    expect(reportAiStudioStabilityEventMock).toHaveBeenCalledWith(
      "window_blur",
      expect.any(Object)
    );
    expect(reportAiStudioStabilityEventMock).toHaveBeenCalledWith(
      "window_focus",
      expect.any(Object)
    );
  });

  it("keeps the document id stable across soft remounts but marks a new document", () => {
    const { unmount } = renderHook(() =>
      useAiStudioStabilityLifecycleTelemetry({
        projectId: null,
        projectRouteRequested: false,
      })
    );
    const firstDocumentId =
      reportAiStudioStabilityEventMock.mock.calls[0]?.[1]?.lifecycle_document_id;
    unmount();
    reportAiStudioStabilityEventMock.mockClear();

    const { unmount: unmountSecond } = renderHook(() =>
      useAiStudioStabilityLifecycleTelemetry({
        projectId: null,
        projectRouteRequested: false,
      })
    );
    expect(reportAiStudioStabilityEventMock).toHaveBeenCalledWith(
      "session_started",
      expect.objectContaining({
        lifecycle_document_id: firstDocumentId,
        previous_lifecycle_document_id_present: false,
        lifecycle_document_replaced: false,
      })
    );
    unmountSecond();

    reportAiStudioStabilityEventMock.mockClear();
    clearLifecycleWindowState();

    renderHook(() =>
      useAiStudioStabilityLifecycleTelemetry({
        projectId: null,
        projectRouteRequested: false,
      })
    );

    expect(reportAiStudioStabilityEventMock).toHaveBeenCalledWith(
      "session_started",
      expect.objectContaining({
        previous_lifecycle_document_id_present: true,
        lifecycle_document_replaced: true,
      })
    );
    expect(reportAiStudioStabilityEventMock.mock.calls[0]?.[1]?.lifecycle_document_id).not.toBe(
      firstDocumentId
    );
  });
});
