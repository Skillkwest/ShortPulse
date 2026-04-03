import { useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { randomId } from "../logic/ids";
import { StudioMode } from "../types";
import {
  hasStoredVideoPreferences,
  IMAGE_RESOLUTION_STORAGE_KEY,
  readSessionStorageNumberPreference,
  readSessionStorageStringPreference,
  VIDEO_DURATION_STORAGE_KEY,
  VIDEO_RESOLUTION_STORAGE_KEY,
} from "./aiStudioStateConfig";
import type { ExpertEditSessionState } from "../components/edit/expertEditSessionState";

export type UseAiStudioCreationStateResult = {
  promptRef: MutableRefObject<HTMLTextAreaElement | null>;
  mode: StudioMode;
  setMode: Dispatch<SetStateAction<StudioMode>>;
  aspect: string;
  setAspect: Dispatch<SetStateAction<string>>;
  model: string | null;
  setModelState: Dispatch<SetStateAction<string | null>>;
  prompt: string;
  setPrompt: Dispatch<SetStateAction<string>>;
  editReferenceText: string;
  setEditReferenceTextState: Dispatch<SetStateAction<string>>;
  videoReferenceText: string;
  setVideoReferenceTextState: Dispatch<SetStateAction<string>>;
  expertEditSessionState: ExpertEditSessionState | null;
  setExpertEditSessionState: Dispatch<SetStateAction<ExpertEditSessionState | null>>;
  videoReferenceMode: "standard" | "modify" | "keyframes" | "kling3" | "motion";
  setVideoReferenceMode: Dispatch<
    SetStateAction<"standard" | "modify" | "keyframes" | "kling3" | "motion">
  >;
  videoDurationSeconds: number;
  setVideoDurationSeconds: Dispatch<SetStateAction<number>>;
  videoResolution: string;
  setVideoResolution: Dispatch<SetStateAction<string>>;
  imageResolution: string;
  setImageResolution: Dispatch<SetStateAction<string>>;
  hasUserVideoPrefs: boolean;
  setHasUserVideoPrefs: Dispatch<SetStateAction<boolean>>;
  videoGenerateAudio: boolean;
  setVideoGenerateAudio: Dispatch<SetStateAction<boolean>>;
  videoCameraFixed: boolean;
  setVideoCameraFixed: Dispatch<SetStateAction<boolean>>;
  videoAutoFix: boolean;
  setVideoAutoFix: Dispatch<SetStateAction<boolean>>;
  klingNegativePrompt: string;
  setKlingNegativePrompt: Dispatch<SetStateAction<string>>;
  klingCfgScale: number;
  setKlingCfgScale: Dispatch<SetStateAction<number>>;
  klingShotType: "customize" | "intelligent";
  setKlingShotType: Dispatch<SetStateAction<"customize" | "intelligent">>;
  klingVoiceIds: [string, string];
  setKlingVoiceIds: Dispatch<SetStateAction<[string, string]>>;
  klingMultiPrompts: { id: string; prompt: string; duration: number }[];
  setKlingMultiPrompts: Dispatch<
    SetStateAction<{ id: string; prompt: string; duration: number }[]>
  >;
  klingElements: {
    id: string;
    frontalImageUrl: string;
    referenceImageUrls: string;
    videoUrl: string;
  }[];
  setKlingElements: Dispatch<
    SetStateAction<
      {
        id: string;
        frontalImageUrl: string;
        referenceImageUrls: string;
        videoUrl: string;
      }[]
    >
  >;
  isPromptGenerating: boolean;
  setIsPromptGenerating: Dispatch<SetStateAction<boolean>>;
  uiError: string | null;
  setUiError: Dispatch<SetStateAction<string | null>>;
  uiNotice: string | null;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
  lastVideoReferenceModeRef: MutableRefObject<
    "standard" | "modify" | "keyframes" | "kling3" | "motion"
  >;
  lastNonKling3VideoModelRef: MutableRefObject<string | null>;
  lastNonKeyframesVideoModelRef: MutableRefObject<string | null>;
  lastNonMotionVideoModelRef: MutableRefObject<string | null>;
};

export const useAiStudioCreationState = (): UseAiStudioCreationStateResult => {
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  const [mode, setMode] = useState<StudioMode>("text");
  const [aspect, setAspect] = useState<string>("9:16");
  const [model, setModelState] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [editReferenceText, setEditReferenceTextState] = useState<string>("");
  const [videoReferenceText, setVideoReferenceTextState] = useState<string>("");
  const [expertEditSessionState, setExpertEditSessionState] =
    useState<ExpertEditSessionState | null>(null);
  const [videoReferenceMode, setVideoReferenceMode] = useState<
    "standard" | "modify" | "keyframes" | "kling3" | "motion"
  >("standard");
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number>(() =>
    readSessionStorageNumberPreference(VIDEO_DURATION_STORAGE_KEY, 6)
  );
  const [videoResolution, setVideoResolution] = useState<string>(() =>
    readSessionStorageStringPreference(VIDEO_RESOLUTION_STORAGE_KEY, "1080p")
  );
  const [imageResolution, setImageResolution] = useState<string>(() =>
    readSessionStorageStringPreference(IMAGE_RESOLUTION_STORAGE_KEY, "model_default")
  );
  const [hasUserVideoPrefs, setHasUserVideoPrefs] = useState<boolean>(hasStoredVideoPreferences);
  const [videoGenerateAudio, setVideoGenerateAudio] = useState<boolean>(false);
  const [videoCameraFixed, setVideoCameraFixed] = useState<boolean>(false);
  const [videoAutoFix, setVideoAutoFix] = useState<boolean>(false);
  const [klingNegativePrompt, setKlingNegativePrompt] = useState<string>(
    "blur, distort, and low quality"
  );
  const [klingCfgScale, setKlingCfgScale] = useState<number>(0.5);
  const [klingShotType, setKlingShotType] = useState<"customize" | "intelligent">("customize");
  const [klingVoiceIds, setKlingVoiceIds] = useState<[string, string]>(["", ""]);
  const [klingMultiPrompts, setKlingMultiPrompts] = useState<
    { id: string; prompt: string; duration: number }[]
  >([]);
  const [klingElements, setKlingElements] = useState<
    { id: string; frontalImageUrl: string; referenceImageUrls: string; videoUrl: string }[]
  >([{ id: randomId(), frontalImageUrl: "", referenceImageUrls: "", videoUrl: "" }]);
  const [isPromptGenerating, setIsPromptGenerating] = useState<boolean>(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [uiNotice, setUiNotice] = useState<string | null>(null);
  const lastVideoReferenceModeRef = useRef(videoReferenceMode);
  const lastNonKling3VideoModelRef = useRef<string | null>(null);
  const lastNonKeyframesVideoModelRef = useRef<string | null>(null);
  const lastNonMotionVideoModelRef = useRef<string | null>(null);

  return {
    promptRef,
    mode,
    setMode,
    aspect,
    setAspect,
    model,
    setModelState,
    prompt,
    setPrompt,
    editReferenceText,
    setEditReferenceTextState,
    videoReferenceText,
    setVideoReferenceTextState,
    expertEditSessionState,
    setExpertEditSessionState,
    videoReferenceMode,
    setVideoReferenceMode,
    videoDurationSeconds,
    setVideoDurationSeconds,
    videoResolution,
    setVideoResolution,
    imageResolution,
    setImageResolution,
    hasUserVideoPrefs,
    setHasUserVideoPrefs,
    videoGenerateAudio,
    setVideoGenerateAudio,
    videoCameraFixed,
    setVideoCameraFixed,
    videoAutoFix,
    setVideoAutoFix,
    klingNegativePrompt,
    setKlingNegativePrompt,
    klingCfgScale,
    setKlingCfgScale,
    klingShotType,
    setKlingShotType,
    klingVoiceIds,
    setKlingVoiceIds,
    klingMultiPrompts,
    setKlingMultiPrompts,
    klingElements,
    setKlingElements,
    isPromptGenerating,
    setIsPromptGenerating,
    uiError,
    setUiError,
    uiNotice,
    setUiNotice,
    lastVideoReferenceModeRef,
    lastNonKling3VideoModelRef,
    lastNonKeyframesVideoModelRef,
    lastNonMotionVideoModelRef,
  };
};
