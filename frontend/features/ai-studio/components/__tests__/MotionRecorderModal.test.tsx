import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MotionRecorderModal } from "../MotionRecorderModal";

const uploadVideoFileToStorageMock = vi.fn();

vi.mock("../../utils/videoUpload", () => ({
  uploadVideoFileToStorage: (file: File) => uploadVideoFileToStorageMock(file),
}));

describe("MotionRecorderModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    uploadVideoFileToStorageMock.mockReset();
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
      configurable: true,
      writable: true,
      value: null,
    });
  });

  it("records and stages a motion clip into the canonical motion URL flow", async () => {
    const mediaStreamTrackStop = vi.fn();
    const mediaStream = {
      getTracks: () => [{ stop: mediaStreamTrackStop }],
      getVideoTracks: () => [{ getSettings: () => ({ deviceId: "camera-1" }) }],
    };
    const getUserMediaMock = vi.fn().mockResolvedValue(mediaStream);
    const enumerateDevicesMock = vi.fn().mockResolvedValue([
      {
        deviceId: "camera-1",
        groupId: "group-camera-1",
        kind: "videoinput",
        label: "Front Camera",
        toJSON: () => ({}),
      },
    ]);

    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: getUserMediaMock,
        enumerateDevices: enumerateDevicesMock,
      },
    });
    Object.defineProperty(globalThis.navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn(async ({ name }: { name: string }) => ({
          name,
          state: "granted",
          onchange: null,
        })),
      },
    });

    class MockMediaRecorder {
      static isTypeSupported(type: string) {
        return type === "video/webm;codecs=vp9,opus" || type === "video/webm";
      }

      mimeType: string;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(_stream: MediaStream, options?: { mimeType?: string }) {
        this.mimeType = options?.mimeType ?? "video/webm";
      }

      start() {}

      stop() {
        this.ondataavailable?.({
          data: new Blob(["recorded-video"], { type: this.mimeType }),
        });
        this.onstop?.();
      }
    }

    vi.stubGlobal("MediaRecorder", MockMediaRecorder);

    uploadVideoFileToStorageMock.mockResolvedValue({
      url: "https://example.com/staged-motion.webm",
      path: "videos/motion-control/staged-motion.webm",
      size: 14,
    });

    const onApplyVideo = vi.fn();
    const onClose = vi.fn();

    render(<MotionRecorderModal isOpen={true} onClose={onClose} onApplyVideo={onApplyVideo} />);

    expect(getUserMediaMock).not.toHaveBeenCalled();
    expect(screen.getByText("Preview starts after you click record")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Record motion clip" }));

    await waitFor(() => {
      expect(getUserMediaMock).toHaveBeenCalledTimes(1);
    });
    await screen.findByText("Live preview");

    fireEvent.click(await screen.findByRole("button", { name: "Stop motion recording" }));

    await screen.findByRole("button", { name: "Use clip" });
    fireEvent.click(screen.getByRole("button", { name: "Use clip" }));

    await waitFor(() => {
      expect(uploadVideoFileToStorageMock).toHaveBeenCalledWith(expect.any(File));
    });

    expect(onApplyVideo).toHaveBeenCalledWith("https://example.com/staged-motion.webm");
    expect(onClose).toHaveBeenCalled();
    expect(mediaStreamTrackStop).toHaveBeenCalled();
  });

  it("shows only detected cameras in the camera picker", async () => {
    const mediaStream = {
      getTracks: () => [{ stop: vi.fn() }],
      getVideoTracks: () => [{ getSettings: () => ({ deviceId: "camera-1" }) }],
    };
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mediaStream),
        enumerateDevices: vi.fn().mockResolvedValue([
          {
            deviceId: "camera-1",
            groupId: "group-camera-1",
            kind: "videoinput",
            label: "Front Camera",
            toJSON: () => ({}),
          },
          {
            deviceId: "camera-2",
            groupId: "group-camera-2",
            kind: "videoinput",
            label: "Rear Camera",
            toJSON: () => ({}),
          },
        ]),
      },
    });
    Object.defineProperty(globalThis.navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn(async ({ name }: { name: string }) => ({
          name,
          state: "granted",
          onchange: null,
        })),
      },
    });

    class MockMediaRecorder {
      static isTypeSupported() {
        return true;
      }

      start() {}
      stop() {}
    }

    vi.stubGlobal("MediaRecorder", MockMediaRecorder);

    render(<MotionRecorderModal isOpen={true} onClose={vi.fn()} onApplyVideo={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Record motion clip" }));

    await screen.findByText("Live preview");

    const cameraSelect = screen.getByLabelText("Camera");
    expect(within(cameraSelect).getByRole("option", { name: "Front Camera" })).toBeInTheDocument();
    expect(within(cameraSelect).getByRole("option", { name: "Rear Camera" })).toBeInTheDocument();
    expect(
      within(cameraSelect).queryByRole("option", { name: "Browser default camera" })
    ).toBeNull();
  });

  it("does not invent generic numbered cameras when the browser has not exposed labels yet", async () => {
    const mediaStream = {
      getTracks: () => [{ stop: vi.fn() }],
      getVideoTracks: () => [{ getSettings: () => ({ deviceId: "camera-1" }) }],
    };
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mediaStream),
        enumerateDevices: vi.fn().mockResolvedValue([
          {
            deviceId: "camera-1",
            groupId: "group-camera-1",
            kind: "videoinput",
            label: "",
            toJSON: () => ({}),
          },
          {
            deviceId: "camera-2",
            groupId: "group-camera-2",
            kind: "videoinput",
            label: "",
            toJSON: () => ({}),
          },
        ]),
      },
    });
    Object.defineProperty(globalThis.navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn(async ({ name }: { name: string }) => ({
          name,
          state: "granted",
          onchange: null,
        })),
      },
    });

    class MockMediaRecorder {
      static isTypeSupported() {
        return true;
      }

      start() {}
      stop() {}
    }

    vi.stubGlobal("MediaRecorder", MockMediaRecorder);

    render(<MotionRecorderModal isOpen={true} onClose={vi.fn()} onApplyVideo={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Record motion clip" }));

    await screen.findByText("Live preview");
    expect(screen.getByText("No labeled cameras detected yet.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Camera")).toBeNull();
    expect(screen.queryByText("Camera 1")).toBeNull();
    expect(screen.queryByText("Camera 2")).toBeNull();
  });

  it("surfaces blocked camera recovery guidance and only opens settings on explicit action", async () => {
    Object.defineProperty(globalThis.navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    });
    Object.defineProperty(globalThis.navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn(async ({ name }: { name: string }) => ({
          name,
          state: "denied",
          onchange: null,
        })),
      },
    });
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue({
          name: "NotAllowedError",
          message: "",
        }),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    });
    const windowOpenMock = vi.fn();
    Object.defineProperty(window, "open", {
      configurable: true,
      value: windowOpenMock,
    });

    class MockMediaRecorder {
      static isTypeSupported() {
        return true;
      }
    }

    vi.stubGlobal("MediaRecorder", MockMediaRecorder);

    render(<MotionRecorderModal isOpen={true} onClose={vi.fn()} onApplyVideo={vi.fn()} />);

    expect(screen.queryByText(/camera access is blocked/i)).not.toBeInTheDocument();
    expect(windowOpenMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Record motion clip" }));

    expect(await screen.findByText(/camera access is blocked/i)).toBeInTheDocument();
    expect(
      screen.getByText(/allow camera access in your browser's site settings/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open camera settings" }));

    await waitFor(() => {
      expect(windowOpenMock).toHaveBeenCalledWith(
        "x-apple.systempreferences:com.apple.preference.security?Privacy_Camera",
        "_blank",
        "noopener,noreferrer"
      );
    });
  });

  it("keeps the blocked state in the record flow until camera access is resolved", async () => {
    const mediaStream = {
      getTracks: () => [{ stop: vi.fn() }],
      getVideoTracks: () => [{ getSettings: () => ({ deviceId: "camera-1" }) }],
    };
    const getUserMediaMock = vi
      .fn()
      .mockRejectedValueOnce({
        name: "NotAllowedError",
        message: "Permission denied",
      })
      .mockResolvedValueOnce(mediaStream);

    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: getUserMediaMock,
        enumerateDevices: vi.fn().mockResolvedValue([
          {
            deviceId: "camera-1",
            groupId: "group-camera-1",
            kind: "videoinput",
            label: "Front Camera",
            toJSON: () => ({}),
          },
        ]),
      },
    });
    Object.defineProperty(globalThis.navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn(async ({ name }: { name: string }) => ({
          name,
          state: "prompt",
          onchange: null,
        })),
      },
    });
    const windowOpenMock = vi.fn();
    Object.defineProperty(window, "open", {
      configurable: true,
      value: windowOpenMock,
    });

    class MockMediaRecorder {
      static isTypeSupported(type: string) {
        return type === "video/webm;codecs=vp9,opus" || type === "video/webm";
      }

      mimeType: string;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(_stream: MediaStream, options?: { mimeType?: string }) {
        this.mimeType = options?.mimeType ?? "video/webm";
      }

      start() {}
      stop() {}
    }

    vi.stubGlobal("MediaRecorder", MockMediaRecorder);

    render(<MotionRecorderModal isOpen={true} onClose={vi.fn()} onApplyVideo={vi.fn()} />);

    expect(getUserMediaMock).toHaveBeenCalledTimes(0);
    expect(windowOpenMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Record motion clip" }));

    expect(await screen.findByText(/camera access is blocked/i)).toBeInTheDocument();
    expect(getUserMediaMock).toHaveBeenCalledTimes(1);
    expect(windowOpenMock).not.toHaveBeenCalled();
  });

  it("keeps the recorded clip when switching to a broken camera device", async () => {
    const mediaStream = {
      getTracks: () => [{ stop: vi.fn() }],
      getVideoTracks: () => [{ getSettings: () => ({ deviceId: "camera-1" }) }],
    };
    const getUserMediaMock = vi.fn().mockResolvedValueOnce(mediaStream).mockRejectedValueOnce({
      name: "NotFoundError",
      message: "Camera not found",
    });
    const enumerateDevicesMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          deviceId: "camera-1",
          groupId: "group-camera-1",
          kind: "videoinput",
          label: "Front Camera",
          toJSON: () => ({}),
        },
        {
          deviceId: "camera-2",
          groupId: "group-camera-2",
          kind: "videoinput",
          label: "Rear Camera",
          toJSON: () => ({}),
        },
      ])
      .mockResolvedValueOnce([
        {
          deviceId: "camera-1",
          groupId: "group-camera-1",
          kind: "videoinput",
          label: "Front Camera",
          toJSON: () => ({}),
        },
        {
          deviceId: "camera-2",
          groupId: "group-camera-2",
          kind: "videoinput",
          label: "Rear Camera",
          toJSON: () => ({}),
        },
      ]);

    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: getUserMediaMock,
        enumerateDevices: enumerateDevicesMock,
      },
    });
    Object.defineProperty(globalThis.navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn(async ({ name }: { name: string }) => ({
          name,
          state: "granted",
          onchange: null,
        })),
      },
    });

    class MockMediaRecorder {
      static isTypeSupported(type: string) {
        return type === "video/webm;codecs=vp9,opus" || type === "video/webm";
      }

      mimeType: string;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(_stream: MediaStream, options?: { mimeType?: string }) {
        this.mimeType = options?.mimeType ?? "video/webm";
      }

      start() {}

      stop() {
        this.ondataavailable?.({
          data: new Blob(["recorded-video"], { type: this.mimeType }),
        });
        this.onstop?.();
      }
    }

    vi.stubGlobal("MediaRecorder", MockMediaRecorder);

    render(<MotionRecorderModal isOpen={true} onClose={vi.fn()} onApplyVideo={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Record motion clip" }));

    await waitFor(() => {
      expect(getUserMediaMock).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(await screen.findByRole("button", { name: "Stop motion recording" }));
    await screen.findByRole("button", { name: "Use clip" });

    fireEvent.change(screen.getByLabelText("Camera"), {
      target: { value: "camera-2" },
    });

    expect(await screen.findByText("Review recorded clip")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use clip" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retake" })).toBeInTheDocument();
  });
});
