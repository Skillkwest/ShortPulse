/**
 * Voice source recorder runtime.
 * Owns browser microphone permission state, MediaRecorder lifecycle, elapsed
 * time, and recorded audio source creation for Voice Changer-style intake UI.
 */
import React from "react";
import {
  createVoiceChangerSourceFromFile,
  type VoiceChangerSource,
} from "../logic/voiceChangerSourceIntake";

type BrowserMediaRecorder = typeof MediaRecorder;
type RecordingFeedback = {
  message: string;
  recoveryHint: string | null;
};
type MicrophonePermissionState = "granted" | "prompt" | "denied" | "unsupported";

type UseVoiceSourceRecorderParams = {
  idleCue: string;
  onBeforeRecord?: () => void;
  onRecordedSource: (source: VoiceChangerSource | null) => void;
};

const resolveRecordingMimeType = (MediaRecorderCtor: BrowserMediaRecorder): string => {
  const preferredTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
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
  if (normalized.includes("mp4")) return "m4a";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("wav")) return "wav";
  return "webm";
};

const resolveRecordingUnavailableFeedback = (): RecordingFeedback => {
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return {
      message: "Microphone recording requires HTTPS or localhost.",
      recoveryHint:
        "Open ShortPulse in a secure browser tab, then try recording again. If this still fails, check your browser and system microphone settings.",
    };
  }
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return {
      message: "Recording is not supported in this browser.",
      recoveryHint:
        "Upload an audio file instead, or switch to a browser that supports microphone recording.",
    };
  }
  return {
    message: "This browser cannot record audio here.",
    recoveryHint:
      "Upload an audio file instead, or switch to a browser that supports microphone recording.",
  };
};

const resolveRecordingStartErrorFeedback = (error: unknown): RecordingFeedback => {
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

  if (
    normalizedName === "notallowederror" ||
    normalizedName === "permissiondeniederror" ||
    normalizedName === "securityerror" ||
    /permission|denied|not allowed|disallow/.test(normalizedMessage)
  ) {
    return {
      message: "Microphone access is blocked.",
      recoveryHint:
        "Allow microphone access in your browser's site settings. If it is still blocked, enable ShortPulse in your computer's system microphone settings, then try again.",
    };
  }
  if (
    normalizedName === "notfounderror" ||
    normalizedName === "devicesnotfounderror" ||
    normalizedName === "overconstrainederror" ||
    /no microphone|no audio input|not found|no device/.test(normalizedMessage)
  ) {
    return {
      message: "No microphone was found on this device.",
      recoveryHint: "Connect or enable a microphone, then try recording again.",
    };
  }
  if (
    normalizedName === "notreadableerror" ||
    normalizedName === "trackstarterror" ||
    /not readable|could not start audio source|device in use|hardware error|concurrent mic process limit/.test(
      normalizedMessage
    )
  ) {
    return {
      message: "Your microphone is unavailable or already in use by another app.",
      recoveryHint: "Close other apps that may be using the microphone, then try again.",
    };
  }
  if (normalizedName === "aborterror") {
    return {
      message: "Microphone access was interrupted.",
      recoveryHint:
        "Try recording again. If it keeps happening, refresh the page and recheck your microphone permissions.",
    };
  }
  return {
    message: "Unable to start recording.",
    recoveryHint: "Check your browser and system microphone settings, then try again.",
  };
};

const resolvePermissionPreflightFeedback = (
  permissionState: MicrophonePermissionState,
  idleCue: string
): RecordingFeedback | null => {
  if (permissionState === "denied") {
    return {
      message: "Microphone access is blocked.",
      recoveryHint:
        "Allow microphone access in your browser's site settings. If it is still blocked, enable ShortPulse in your computer's system microphone settings before recording.",
    };
  }
  if (permissionState === "prompt") {
    return {
      message: idleCue,
      recoveryHint: "Your browser will ask for microphone access when you record.",
    };
  }
  return null;
};

export const formatVoiceRecordingDuration = (valueMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

/**
 * Returns MediaRecorder state and controls for recording a voice source file.
 */
export const useVoiceSourceRecorder = ({
  idleCue,
  onBeforeRecord,
  onRecordedSource,
}: UseVoiceSourceRecorderParams) => {
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const recorderStreamRef = React.useRef<MediaStream | null>(null);
  const recordingChunksRef = React.useRef<BlobPart[]>([]);
  const recordingStartedAtRef = React.useRef<number | null>(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = React.useState(false);
  const [microphonePermissionState, setMicrophonePermissionState] =
    React.useState<MicrophonePermissionState>("unsupported");
  const [recordingElapsedMs, setRecordingElapsedMs] = React.useState(0);
  const [recordingError, setRecordingError] = React.useState<string | null>(null);
  const [recordingRecoveryHint, setRecordingRecoveryHint] = React.useState<string | null>(null);

  const stopRecorderStream = React.useCallback(() => {
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    recorderStreamRef.current = null;
  }, []);

  React.useEffect(() => {
    if (!isRecording) {
      setRecordingElapsedMs(0);
      return;
    }
    const timer = window.setInterval(() => {
      if (recordingStartedAtRef.current == null) return;
      setRecordingElapsedMs(Date.now() - recordingStartedAtRef.current);
    }, 250);
    return () => {
      window.clearInterval(timer);
    };
  }, [isRecording]);

  React.useEffect(() => {
    return () => {
      recorderRef.current?.stop?.();
      recorderRef.current = null;
      stopRecorderStream();
    };
  }, [stopRecorderStream]);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }
    if (!navigator.permissions?.query) {
      setMicrophonePermissionState("unsupported");
      return;
    }

    let isActive = true;
    let permissionStatus: PermissionStatus | null = null;
    const applyPermissionState = (value: string) => {
      if (!isActive) return;
      if (value === "granted" || value === "prompt" || value === "denied") {
        setMicrophonePermissionState(value);
        return;
      }
      setMicrophonePermissionState("unsupported");
    };

    void navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((status) => {
        permissionStatus = status;
        applyPermissionState(status.state);
        status.onchange = () => applyPermissionState(status.state);
      })
      .catch(() => {
        if (isActive) {
          setMicrophonePermissionState("unsupported");
        }
      });

    return () => {
      isActive = false;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  const permissionPreflightFeedback = React.useMemo(
    () => resolvePermissionPreflightFeedback(microphonePermissionState, idleCue),
    [idleCue, microphonePermissionState]
  );

  const handleRecordSampleClick = React.useCallback(async () => {
    if (isRecording) {
      recorderRef.current?.stop();
      return;
    }
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setIsRequestingPermission(false);
      const feedback = resolveRecordingUnavailableFeedback();
      setRecordingError(feedback.message);
      setRecordingRecoveryHint(feedback.recoveryHint);
      return;
    }

    onBeforeRecord?.();
    setRecordingError(null);
    setRecordingRecoveryHint(null);
    setIsRequestingPermission(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRequestingPermission(false);
      recorderStreamRef.current = stream;
      const mimeType = resolveRecordingMimeType(MediaRecorder);
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setRecordingError("Unable to record audio right now.");
        setRecordingRecoveryHint(
          "Check your browser and system microphone settings, then try again."
        );
        setIsRequestingPermission(false);
        setIsRecording(false);
        recorderRef.current = null;
        recordingChunksRef.current = [];
        stopRecorderStream();
      };

      recorder.onstop = () => {
        const recordedMimeType = recorder.mimeType || mimeType || "audio/webm";
        const recordedBlob = new Blob(recordingChunksRef.current, { type: recordedMimeType });
        recordingChunksRef.current = [];
        recorderRef.current = null;
        setIsRecording(false);
        stopRecorderStream();

        if (!recordedBlob.size) {
          setRecordingError("No audio was captured.");
          setRecordingRecoveryHint("Try again and speak after the recording indicator turns on.");
          return;
        }

        const extension = resolveRecordingExtension(recordedMimeType);
        const file = new File([recordedBlob], `voice-sample-${Date.now()}.${extension}`, {
          type: recordedMimeType,
        });
        onRecordedSource(createVoiceChangerSourceFromFile(file));
      };

      recordingStartedAtRef.current = Date.now();
      setRecordingElapsedMs(0);
      setIsRecording(true);
      recorder.start();
    } catch (error) {
      stopRecorderStream();
      setIsRequestingPermission(false);
      setIsRecording(false);
      setRecordingElapsedMs(0);
      const feedback = resolveRecordingStartErrorFeedback(error);
      setRecordingError(feedback.message);
      setRecordingRecoveryHint(feedback.recoveryHint);
    }
  }, [isRecording, onBeforeRecord, onRecordedSource, stopRecorderStream]);

  return {
    isRecording,
    isRequestingPermission,
    microphonePermissionState,
    recordingElapsedMs,
    recordingError,
    recordingRecoveryHint,
    permissionPreflightFeedback,
    handleRecordSampleClick,
  };
};
