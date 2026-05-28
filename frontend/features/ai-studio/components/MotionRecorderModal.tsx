/**
 * Motion recorder modal for Motion Control reference video capture.
 * Records a local camera clip, stages it to storage, and hands the signed URL back
 * to the canonical motion reference video path.
 */
import React from "react";
import { Camera, CircleNotch, X } from "phosphor-react";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";
import { attemptOpenCapturePermissionSettings } from "../utils/capturePermissionRecovery";
import { uploadVideoFileToStorage } from "../utils/videoUpload";
import { AiStudioRecordPanelPrefab } from "./AiStudioRecordPanelPrefab";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";

type MotionRecorderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onApplyVideo: (url: string) => void;
};

type CapturePermissionState = "granted" | "prompt" | "denied" | "unsupported";
type CaptureFeedback = {
  message: string;
  recoveryHint: string | null;
};

type DeviceOption = {
  deviceId: string;
  label: string;
};

type BrowserMediaRecorder = typeof MediaRecorder;

const MOTION_RECORDER_VIDEO_DEVICE_STORAGE_KEY =
  "shortpulse.aiStudio.motionRecorder.preferredVideoDeviceId";

const isClient = (): boolean => typeof window !== "undefined" && typeof navigator !== "undefined";

const readStoredDeviceId = (storageKey: string): string => {
  if (!isClient()) return "";
  try {
    return window.localStorage.getItem(storageKey)?.trim() ?? "";
  } catch {
    return "";
  }
};

const writeStoredDeviceId = (storageKey: string, value: string): void => {
  if (!isClient()) return;
  try {
    if (value.trim()) {
      window.localStorage.setItem(storageKey, value);
      return;
    }
    window.localStorage.removeItem(storageKey);
  } catch {
    // Best effort only. The modal can still operate without persistence.
  }
};

const resolveVideoRecordingMimeType = (MediaRecorderCtor: BrowserMediaRecorder): string => {
  const preferredTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const type of preferredTypes) {
    if (
      typeof MediaRecorderCtor.isTypeSupported === "function" &&
      MediaRecorderCtor.isTypeSupported(type)
    ) {
      return type;
    }
  }
  return "";
};

const resolveRecordingExtension = (mimeType: string): string => {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.includes("webm")) return "webm";
  if (normalized.includes("mp4")) return "mp4";
  if (normalized.includes("quicktime")) return "mov";
  return "webm";
};

const resolveRecordingUnavailableFeedback = (): CaptureFeedback => {
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return {
      message: "Camera recording requires HTTPS or localhost.",
      recoveryHint:
        "Open ShortPulse in a secure browser tab, then try again. If this still fails, check your browser and system camera settings.",
    };
  }
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return {
      message: "Recording is not supported in this browser.",
      recoveryHint: "Upload a video instead, or switch to a browser that supports camera capture.",
    };
  }
  return {
    message: "This browser cannot record video here.",
    recoveryHint: "Upload a video instead, or switch to a browser that supports camera capture.",
  };
};

const resolveRecordingStartErrorFeedback = (error: unknown): CaptureFeedback => {
  const name =
    typeof (error as { name?: unknown } | null)?.name === "string"
      ? ((error as { name: string }).name || "").trim()
      : "";
  const normalizedName = name.toLowerCase();
  const message =
    typeof (error as { message?: unknown } | null)?.message === "string"
      ? ((error as { message: string }).message || "").trim()
      : "";
  const normalizedMessage = message.toLowerCase();

  if (isPermissionDeniedCaptureError(error)) {
    return {
      message: "Camera access is blocked.",
      recoveryHint:
        "Allow camera access in your browser's site settings. If it is still blocked, enable ShortPulse in your computer's system camera settings, then try again.",
    };
  }
  if (
    normalizedName === "notfounderror" ||
    normalizedName === "devicesnotfounderror" ||
    normalizedName === "overconstrainederror" ||
    /no camera|not found|no device/.test(normalizedMessage)
  ) {
    return {
      message: "No usable camera was found on this device.",
      recoveryHint: "Connect or enable a camera, then try recording again.",
    };
  }
  if (
    normalizedName === "notreadableerror" ||
    normalizedName === "trackstarterror" ||
    /not readable|could not start|device in use|hardware error|concurrent/.test(normalizedMessage)
  ) {
    return {
      message: "Your camera is unavailable or already in use.",
      recoveryHint: "Close other apps that may be using your camera, then try again.",
    };
  }
  if (normalizedName === "aborterror") {
    return {
      message: "Camera access was interrupted.",
      recoveryHint:
        "Try again. If it keeps happening, refresh the page and recheck your browser permissions.",
    };
  }
  return {
    message: "Unable to start the camera.",
    recoveryHint: "Check your browser and system camera settings, then try again.",
  };
};

const isPermissionDeniedCaptureError = (error: unknown): boolean => {
  const normalizedName =
    typeof (error as { name?: unknown } | null)?.name === "string"
      ? ((error as { name: string }).name || "").trim().toLowerCase()
      : "";
  const normalizedMessage =
    typeof (error as { message?: unknown } | null)?.message === "string"
      ? ((error as { message: string }).message || "").trim().toLowerCase()
      : "";

  return (
    normalizedName === "notallowederror" ||
    normalizedName === "permissiondeniederror" ||
    normalizedName === "securityerror" ||
    /permission|denied|not allowed|disallow/.test(normalizedMessage)
  );
};

const formatRecordingDuration = (valueMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const resolvePermissionPreflightFeedback = ({
  cameraPermissionState,
}: {
  cameraPermissionState: CapturePermissionState;
}): CaptureFeedback | null => {
  if (cameraPermissionState === "denied") {
    return {
      message: "Camera access is blocked.",
      recoveryHint:
        "Allow camera access in your browser's site settings. Browser and system settings are managed outside ShortPulse.",
    };
  }
  if (cameraPermissionState === "prompt") {
    return {
      message: "ShortPulse will ask for camera access.",
      recoveryHint:
        "After access is granted, you can review the preview before you start recording.",
    };
  }
  return null;
};

const shouldAutoResumePreview = (permissionState: CapturePermissionState): boolean =>
  permissionState === "granted" ||
  permissionState === "prompt" ||
  permissionState === "unsupported";

const formatDeviceLabel = (
  device: MediaDeviceInfo,
  fallbackLabel: "Camera",
  index: number
): string => {
  const trimmedLabel = device.label.trim();
  if (trimmedLabel) return trimmedLabel;
  return `${fallbackLabel} ${index + 1}`;
};

const buildVideoDeviceOptions = (devices: MediaDeviceInfo[]): DeviceOption[] => {
  const filtered = devices.filter((device) => device.kind === "videoinput");
  return filtered.map((device, index) => ({
    deviceId: device.deviceId,
    label: formatDeviceLabel(device, "Camera", index),
  }));
};

const queryPermissionState = async (
  name: PermissionName
): Promise<{ state: CapturePermissionState; status: PermissionStatus | null }> => {
  if (!isClient() || !navigator.permissions?.query) {
    return { state: "unsupported", status: null };
  }
  try {
    const status = await navigator.permissions.query({ name });
    if (status.state === "granted" || status.state === "prompt" || status.state === "denied") {
      return { state: status.state, status };
    }
  } catch {
    // Fall through to unsupported when the browser does not expose the queried permission.
  }
  return { state: "unsupported", status: null };
};

export function MotionRecorderModal({ isOpen, onClose, onApplyVideo }: MotionRecorderModalProps) {
  useAiStudioModalActivity("motion-recorder-modal", isOpen);
  const previewRef = React.useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = React.useRef<MediaStream | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const recordingChunksRef = React.useRef<Blob[]>([]);
  const recordingStartedAtRef = React.useRef<number | null>(null);
  const isOpenRef = React.useRef(isOpen);
  const permissionStatusRef = React.useRef<{
    camera: PermissionStatus | null;
  }>({
    camera: null,
  });
  const previewRequestIdRef = React.useRef(0);
  const recordedObjectUrlRef = React.useRef<string | null>(null);
  const hasAttemptedSettingsRecoveryRef = React.useRef(false);
  const [cameraPermissionState, setCameraPermissionState] =
    React.useState<CapturePermissionState>("prompt");
  const [videoDevices, setVideoDevices] = React.useState<DeviceOption[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = React.useState<string>(() =>
    readStoredDeviceId(MOTION_RECORDER_VIDEO_DEVICE_STORAGE_KEY)
  );
  const [isRequestingAccess, setIsRequestingAccess] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingElapsedMs, setRecordingElapsedMs] = React.useState(0);
  const [recordedClipUrl, setRecordedClipUrl] = React.useState<string | null>(null);
  const [recordedClipFile, setRecordedClipFile] = React.useState<File | null>(null);
  const [captureError, setCaptureError] = React.useState<string | null>(null);
  const [captureRecoveryHint, setCaptureRecoveryHint] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [isUploadingClip, setIsUploadingClip] = React.useState(false);
  const [didAttemptSettingsRecovery, setDidAttemptSettingsRecovery] = React.useState(false);
  const [hasRequestedCameraAccess, setHasRequestedCameraAccess] = React.useState(false);
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(onClose, {
    disabled: isUploadingClip,
  });

  const attemptSettingsRecovery = React.useCallback(async () => {
    const didAttempt = attemptOpenCapturePermissionSettings("camera");
    if (didAttempt) {
      setDidAttemptSettingsRecovery(true);
    }
    return didAttempt;
  }, []);

  const stopPreviewStream = React.useCallback(() => {
    previewStreamRef.current?.getTracks().forEach((track) => track.stop());
    previewStreamRef.current = null;
    if (previewRef.current) {
      previewRef.current.srcObject = null;
    }
  }, []);

  const revokeRecordedObjectUrl = React.useCallback(() => {
    if (!recordedObjectUrlRef.current) return;
    URL.revokeObjectURL(recordedObjectUrlRef.current);
    recordedObjectUrlRef.current = null;
  }, []);

  const resetRecordedClip = React.useCallback(() => {
    revokeRecordedObjectUrl();
    setRecordedClipUrl(null);
    setRecordedClipFile(null);
  }, [revokeRecordedObjectUrl]);

  const loadDeviceOptions = React.useCallback(async () => {
    if (!isClient() || !navigator.mediaDevices?.enumerateDevices) {
      setVideoDevices([]);
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const nextVideoDevices = buildVideoDeviceOptions(devices);
      setVideoDevices(nextVideoDevices);
      setSelectedVideoDeviceId((current) => {
        if (current && nextVideoDevices.some((device) => device.deviceId === current)) {
          return current;
        }
        return nextVideoDevices[0]?.deviceId ?? "";
      });
    } catch {
      setVideoDevices([]);
    }
  }, []);

  const updatePermissions = React.useCallback(async (): Promise<CapturePermissionState> => {
    const camera = await queryPermissionState("camera" as PermissionName);

    permissionStatusRef.current.camera = camera.status;
    setCameraPermissionState(camera.state);

    if (camera.status) {
      camera.status.onchange = () => {
        setCameraPermissionState(
          camera.status?.state === "granted" ||
            camera.status?.state === "prompt" ||
            camera.status?.state === "denied"
            ? camera.status.state
            : "unsupported"
        );
      };
    }
    return camera.state;
  }, []);

  const startPreview = React.useCallback(
    async ({
      nextVideoDeviceId,
    }: {
      nextVideoDeviceId?: string;
    } = {}): Promise<boolean> => {
      if (
        !isClient() ||
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      ) {
        const feedback = resolveRecordingUnavailableFeedback();
        setCaptureError(feedback.message);
        setCaptureRecoveryHint(feedback.recoveryHint);
        return false;
      }

      const requestId = previewRequestIdRef.current + 1;
      previewRequestIdRef.current = requestId;
      setIsRequestingAccess(true);
      setCaptureError(null);
      setCaptureRecoveryHint(null);
      setUploadError(null);
      stopPreviewStream();

      const requestedVideoDeviceId = nextVideoDeviceId ?? selectedVideoDeviceId;

      try {
        const buildConstraints = ({
          videoDeviceId,
        }: {
          videoDeviceId?: string;
        }): MediaStreamConstraints => ({
          video: videoDeviceId
            ? {
                deviceId: { exact: videoDeviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30, max: 30 },
              }
            : {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30, max: 30 },
              },
          audio: false,
        });

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(
            buildConstraints({ videoDeviceId: requestedVideoDeviceId })
          );
        } catch (error) {
          const errorName =
            typeof (error as { name?: unknown } | null)?.name === "string"
              ? ((error as { name: string }).name || "").trim().toLowerCase()
              : "";
          const canRetryWithBrowserDefaults =
            Boolean(requestedVideoDeviceId) &&
            (errorName === "overconstrainederror" || errorName === "notfounderror");
          if (!canRetryWithBrowserDefaults) {
            throw error;
          }
          stream = await navigator.mediaDevices.getUserMedia(buildConstraints({}));
          setSelectedVideoDeviceId("");
          writeStoredDeviceId(MOTION_RECORDER_VIDEO_DEVICE_STORAGE_KEY, "");
        }

        if (previewRequestIdRef.current !== requestId) {
          stream.getTracks().forEach((track) => track.stop());
          return false;
        }

        previewStreamRef.current = stream;
        if (previewRef.current) {
          previewRef.current.srcObject = stream;
          void previewRef.current.play().catch(() => undefined);
        }

        await Promise.all([updatePermissions(), loadDeviceOptions()]);

        const activeVideoDeviceId =
          stream.getVideoTracks()[0]?.getSettings().deviceId ?? requestedVideoDeviceId ?? "";

        setSelectedVideoDeviceId(activeVideoDeviceId);
        writeStoredDeviceId(MOTION_RECORDER_VIDEO_DEVICE_STORAGE_KEY, activeVideoDeviceId);
        return true;
      } catch (error) {
        stopPreviewStream();
        const feedback = resolveRecordingStartErrorFeedback(error);
        setCaptureError(feedback.message);
        setCaptureRecoveryHint(feedback.recoveryHint);
        return false;
      } finally {
        if (previewRequestIdRef.current === requestId) {
          setIsRequestingAccess(false);
        }
      }
    },
    [loadDeviceOptions, selectedVideoDeviceId, stopPreviewStream, updatePermissions]
  );

  const closeModal = React.useCallback(() => {
    if (isUploadingClip) return;
    onClose();
  }, [isUploadingClip, onClose]);

  React.useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) {
      previewRequestIdRef.current += 1;
      recorderRef.current?.stop?.();
      recorderRef.current = null;
      recordingChunksRef.current = [];
      setIsRecording(false);
      setRecordingElapsedMs(0);
      setIsRequestingAccess(false);
      setCaptureError(null);
      setCaptureRecoveryHint(null);
      setUploadError(null);
      hasAttemptedSettingsRecoveryRef.current = false;
      setDidAttemptSettingsRecovery(false);
      setHasRequestedCameraAccess(false);
      stopPreviewStream();
      resetRecordedClip();
      return;
    }

    void updatePermissions();
    void loadDeviceOptions();
  }, [
    isOpen,
    loadDeviceOptions,
    resetRecordedClip,
    startPreview,
    stopPreviewStream,
    updatePermissions,
  ]);

  React.useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isUploadingClip) {
        event.preventDefault();
        closeModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeModal, isOpen, isUploadingClip]);

  React.useEffect(() => {
    if (!isOpen) return undefined;

    const handleVisibilityOrFocus = () => {
      if (!isOpenRef.current || isRecording || isUploadingClip || Boolean(recordedClipUrl)) {
        return;
      }
      void (async () => {
        const nextPermissionState = await updatePermissions();
        if (
          didAttemptSettingsRecovery &&
          !previewStreamRef.current &&
          shouldAutoResumePreview(nextPermissionState)
        ) {
          await startPreview();
        }
      })();
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [
    didAttemptSettingsRecovery,
    isOpen,
    isRecording,
    isUploadingClip,
    recordedClipUrl,
    startPreview,
    updatePermissions,
  ]);

  React.useEffect(() => {
    if (!isRecording) {
      setRecordingElapsedMs(0);
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      const startedAt = recordingStartedAtRef.current;
      if (!startedAt) return;
      setRecordingElapsedMs(Date.now() - startedAt);
    }, 200);
    return () => window.clearInterval(intervalId);
  }, [isRecording]);

  React.useEffect(() => {
    const permissionStatuses = permissionStatusRef.current;
    return () => {
      if (permissionStatuses.camera) {
        permissionStatuses.camera.onchange = null;
      }
      stopPreviewStream();
      revokeRecordedObjectUrl();
    };
  }, [revokeRecordedObjectUrl, stopPreviewStream]);

  const handleRecordClick = React.useCallback(async () => {
    if (isRecording) {
      recorderRef.current?.stop();
      return;
    }

    setHasRequestedCameraAccess(true);
    setCaptureError(null);
    setCaptureRecoveryHint(null);
    setUploadError(null);

    if (!previewStreamRef.current) {
      await startPreview();
      if (!previewStreamRef.current) {
        return;
      }
    }

    if (typeof MediaRecorder === "undefined") {
      const feedback = resolveRecordingUnavailableFeedback();
      setCaptureError(feedback.message);
      setCaptureRecoveryHint(feedback.recoveryHint);
      return;
    }

    resetRecordedClip();
    const mimeType = resolveVideoRecordingMimeType(MediaRecorder);
    const recorder = mimeType
      ? new MediaRecorder(previewStreamRef.current, { mimeType })
      : new MediaRecorder(previewStreamRef.current);
    recordingChunksRef.current = [];
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordingChunksRef.current.push(event.data);
      }
    };

    recorder.onerror = () => {
      setIsRecording(false);
      recorderRef.current = null;
      recordingChunksRef.current = [];
      setCaptureError("Unable to record video right now.");
      setCaptureRecoveryHint(
        "Check your browser and system camera settings, then try recording again."
      );
      stopPreviewStream();
    };

    recorder.onstop = () => {
      const recordedMimeType = recorder.mimeType || mimeType || "video/webm";
      const recordedBlob = new Blob(recordingChunksRef.current, {
        type: recordedMimeType,
      });
      recordingChunksRef.current = [];
      recorderRef.current = null;
      setIsRecording(false);
      stopPreviewStream();

      if (!isOpenRef.current) {
        return;
      }

      if (!recordedBlob.size) {
        setCaptureError("No video was captured.");
        setCaptureRecoveryHint("Try again and wait for the preview before you start recording.");
        return;
      }

      revokeRecordedObjectUrl();
      const objectUrl = URL.createObjectURL(recordedBlob);
      recordedObjectUrlRef.current = objectUrl;
      setRecordedClipUrl(objectUrl);
      const extension = resolveRecordingExtension(recordedMimeType);
      setRecordedClipFile(
        new File([recordedBlob], `motion-reference-${Date.now()}.${extension}`, {
          type: recordedMimeType,
        })
      );
    };

    recordingStartedAtRef.current = Date.now();
    setRecordingElapsedMs(0);
    setIsRecording(true);
    recorder.start();
  }, [isRecording, resetRecordedClip, revokeRecordedObjectUrl, startPreview, stopPreviewStream]);

  const handleRetakeClick = React.useCallback(() => {
    setHasRequestedCameraAccess(true);
    setCaptureError(null);
    setCaptureRecoveryHint(null);
    setUploadError(null);
    resetRecordedClip();
    void startPreview();
  }, [resetRecordedClip, startPreview]);

  const handleOpenSettingsClick = React.useCallback(async () => {
    hasAttemptedSettingsRecoveryRef.current = true;
    setHasRequestedCameraAccess(true);
    const didAttempt = await attemptSettingsRecovery();
    if (!didAttempt) {
      setCaptureRecoveryHint(
        "Open your browser's site settings and your computer's system privacy settings for camera access, then try again."
      );
    }
  }, [attemptSettingsRecovery]);

  const handleUseClipClick = React.useCallback(async () => {
    if (!recordedClipFile) return;
    setIsUploadingClip(true);
    setUploadError(null);
    try {
      const uploaded = await uploadVideoFileToStorage(recordedClipFile);
      onApplyVideo(uploaded.url);
      onClose();
    } catch (error) {
      setUploadError(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Unable to add the recorded clip right now."
      );
    } finally {
      setIsUploadingClip(false);
    }
  }, [onApplyVideo, onClose, recordedClipFile]);

  const handleVideoDeviceChange = React.useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextDeviceId = event.target.value;
      setSelectedVideoDeviceId(nextDeviceId);
      writeStoredDeviceId(MOTION_RECORDER_VIDEO_DEVICE_STORAGE_KEY, nextDeviceId);
      if (isRecording || isUploadingClip || (!previewStreamRef.current && !recordedClipFile))
        return;
      void (async () => {
        const didStartPreview = await startPreview({ nextVideoDeviceId: nextDeviceId });
        if (didStartPreview && recordedClipFile) {
          resetRecordedClip();
        }
      })();
    },
    [isRecording, isUploadingClip, recordedClipFile, resetRecordedClip, startPreview]
  );

  const permissionPreflightFeedback = React.useMemo(
    () => resolvePermissionPreflightFeedback({ cameraPermissionState }),
    [cameraPermissionState]
  );
  const modalRecordStatusMessage = React.useMemo(() => {
    if (captureError) return captureError;
    if (isRequestingAccess) return "Waiting for camera permission...";
    if (isRecording) return `Recording ${formatRecordingDuration(recordingElapsedMs)}`;
    if (!hasRequestedCameraAccess) return null;
    return permissionPreflightFeedback?.message ?? null;
  }, [
    captureError,
    hasRequestedCameraAccess,
    isRecording,
    isRequestingAccess,
    permissionPreflightFeedback,
    recordingElapsedMs,
  ]);
  const modalRecordRecoveryHint = React.useMemo(() => {
    if (captureError) return captureRecoveryHint;
    if (isRecording) return "Click Stop when the motion reference is complete.";
    if (isRequestingAccess) return null;
    if (!hasRequestedCameraAccess) return null;
    if (didAttemptSettingsRecovery && cameraPermissionState === "denied") {
      return "We tried to open your computer's camera settings. If nothing opened, allow access in your browser's site settings and system privacy settings, then try again.";
    }
    return permissionPreflightFeedback?.recoveryHint ?? null;
  }, [
    captureError,
    cameraPermissionState,
    captureRecoveryHint,
    didAttemptSettingsRecovery,
    hasRequestedCameraAccess,
    isRecording,
    isRequestingAccess,
    permissionPreflightFeedback,
  ]);
  const isModalRecordError =
    Boolean(captureError) || (hasRequestedCameraAccess && cameraPermissionState === "denied");
  const shouldShowSettingsRecoveryAction =
    (hasRequestedCameraAccess && cameraPermissionState === "denied") ||
    captureError === "Camera access is blocked.";
  const isShowingPlayback = Boolean(recordedClipUrl);
  const modalTitle = isShowingPlayback ? "Review recorded clip" : "Record a motion clip";

  if (!isOpen) {
    return null;
  }

  return (
    <AiStudioModalLayer>
      <div className="motion-recorder-modal-backdrop" {...backdropDismiss}>
        <section
          className="motion-recorder-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="motion-recorder-modal-title"
        >
          <header className="motion-recorder-modal-header">
            <div className="motion-recorder-modal-title-group">
              <p className="motion-recorder-modal-eyebrow">Motion Control</p>
              <h2 id="motion-recorder-modal-title" className="motion-recorder-modal-title">
                {modalTitle}
              </h2>
              <p className="motion-recorder-modal-subtitle">
                Use this only if you need a source clip for Motion Control. You can still upload
                your own video in the Motion slot.
              </p>
            </div>
            <button
              type="button"
              className="motion-recorder-modal-close"
              onClick={closeModal}
              disabled={isUploadingClip}
              aria-label="Close motion recorder"
            >
              <X size={16} weight="bold" />
            </button>
          </header>

          <div className="motion-recorder-modal-body">
            <div className="motion-recorder-modal-preview-shell">
              {isShowingPlayback ? (
                <video
                  className="motion-recorder-modal-preview"
                  src={recordedClipUrl ?? undefined}
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : (
                <video
                  ref={previewRef}
                  className="motion-recorder-modal-preview"
                  autoPlay
                  muted
                  playsInline
                />
              )}
              {!isShowingPlayback ? (
                <div className="motion-recorder-modal-preview-overlay">
                  {isRequestingAccess ? (
                    <span className="motion-recorder-modal-preview-badge">
                      <CircleNotch size={14} weight="bold" className="motion-recorder-spin" />
                      <span>Requesting camera access…</span>
                    </span>
                  ) : previewStreamRef.current ? (
                    <span className="motion-recorder-modal-preview-badge is-live">
                      <Camera size={14} weight="fill" />
                      <span>Live preview</span>
                    </span>
                  ) : !hasRequestedCameraAccess ? (
                    <span className="motion-recorder-modal-preview-badge">
                      <Camera size={14} weight="regular" />
                      <span>Preview starts after you click record</span>
                    </span>
                  ) : (
                    <span className="motion-recorder-modal-preview-badge">
                      <Camera size={14} weight="regular" />
                      <span>Camera preview unavailable</span>
                    </span>
                  )}
                </div>
              ) : null}
            </div>

            <div className="motion-recorder-modal-sidebar">
              <div className="motion-recorder-device-card">
                <div className="motion-recorder-device-card-header">
                  <h3>Capture setup</h3>
                  <p>ShortPulse remembers your preferred camera for this browser.</p>
                </div>

                <label className="motion-recorder-device-field">
                  <span>
                    <Camera size={14} weight="regular" />
                    <span>Camera</span>
                  </span>
                  {videoDevices.length > 0 ? (
                    <select
                      value={selectedVideoDeviceId}
                      onChange={handleVideoDeviceChange}
                      disabled={isRequestingAccess || isRecording || isUploadingClip}
                    >
                      {videoDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="motion-recorder-device-empty-state" aria-live="polite">
                      No cameras detected yet.
                    </div>
                  )}
                </label>
              </div>

              {isShowingPlayback ? (
                <div className="motion-recorder-status-card" aria-live="polite">
                  <>
                    <p className={`motion-recorder-status-line${uploadError ? " is-error" : ""}`}>
                      {uploadError
                        ? uploadError
                        : isUploadingClip
                          ? "Adding recorded clip..."
                          : "Recorded clip ready to add."}
                    </p>
                    <p className="motion-recorder-status-hint">
                      {uploadError
                        ? "The recording is still here. You can retry staging it without recording again."
                        : isUploadingClip
                          ? "We're staging the clip now so it survives restore and can go straight into Motion Control."
                          : "Use clip replaces the current motion reference video. Retake keeps you in the recorder until you like the result."}
                    </p>
                  </>
                </div>
              ) : null}

              {!isShowingPlayback ? (
                <AiStudioRecordPanelPrefab
                  panelAriaLabel="Record motion clip"
                  title="Record"
                  helper="Record a motion clip only if you need one for Motion Control."
                  buttonIdleAriaLabel="Record motion clip"
                  buttonRecordingAriaLabel="Stop motion recording"
                  idleCue="Click to record"
                  isRecording={isRecording}
                  isBusy={isRequestingAccess || isUploadingClip}
                  statusMessage={modalRecordStatusMessage}
                  recoveryHint={modalRecordRecoveryHint}
                  isError={isModalRecordError}
                  onClick={handleRecordClick}
                />
              ) : null}

              <div className="motion-recorder-modal-actions">
                {isShowingPlayback ? (
                  <>
                    <button
                      type="button"
                      className="motion-recorder-secondary-btn"
                      onClick={handleRetakeClick}
                      disabled={isUploadingClip}
                    >
                      Retake
                    </button>
                    <button
                      type="button"
                      className="motion-recorder-primary-btn"
                      onClick={handleUseClipClick}
                      disabled={isUploadingClip}
                    >
                      {isUploadingClip ? (
                        <>
                          <CircleNotch size={14} weight="bold" className="motion-recorder-spin" />
                          <span>Adding clip…</span>
                        </>
                      ) : (
                        <span>Use clip</span>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    {shouldShowSettingsRecoveryAction ? (
                      <button
                        type="button"
                        className="motion-recorder-secondary-btn"
                        onClick={handleOpenSettingsClick}
                        disabled={isUploadingClip}
                      >
                        Open camera settings
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="motion-recorder-secondary-btn"
                      onClick={closeModal}
                      disabled={isUploadingClip}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </AiStudioModalLayer>
  );
}
