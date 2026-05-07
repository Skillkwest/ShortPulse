import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { StudioMode } from "../types";
import { createEmptyAiStudioKlingElement, type AiStudioKlingElement } from "../logic/klingElements";
import {
  hasStoredVideoPreferences,
  IMAGE_RESOLUTION_STORAGE_KEY,
  readSessionStorageNumberPreference,
  readSessionStorageStringPreference,
  VIDEO_DURATION_STORAGE_KEY,
  VIDEO_RESOLUTION_STORAGE_KEY,
} from "./aiStudioStateConfig";
import type { ExpertEditSessionState } from "../components/edit/expertEditSessionState";

export type AiStudioSubmitPanelKey = "create" | "edit" | "video";
type AiStudioPanelGeneratingState = Record<AiStudioSubmitPanelKey, boolean>;

export type UseAiStudioCreationStateResult = {
  promptRef: MutableRefObject<HTMLTextAreaElement | null>;
  mode: StudioMode;
  setMode: Dispatch<SetStateAction<StudioMode>>;
  aspect: string;
  setAspect: Dispatch<SetStateAction<string>>;
  model: string | null;
  setModelState: Dispatch<SetStateAction<string | null>>;
  standardPrompt: string;
  setStandardPrompt: Dispatch<SetStateAction<string>>;
  pulsePrompt: string;
  setPulsePrompt: Dispatch<SetStateAction<string>>;
  editReferenceText: string;
  setEditReferenceTextState: Dispatch<SetStateAction<string>>;
  videoReferenceText: string;
  setVideoReferenceTextState: Dispatch<SetStateAction<string>>;
  expertEditSessionState: ExpertEditSessionState | null;
  setExpertEditSessionState: Dispatch<SetStateAction<ExpertEditSessionState | null>>;
  publishExpertEditSessionState: Dispatch<SetStateAction<ExpertEditSessionState | null>>;
  getExpertEditSessionState: () => ExpertEditSessionState | null;
  expertEditSessionRevision: number;
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
  klingWorkflowMode: "single" | "multi" | "custom";
  setKlingWorkflowMode: Dispatch<SetStateAction<"single" | "multi" | "custom">>;
  seedance2InputMode: "text" | "first-frame" | "first-last" | "multimodal";
  setSeedance2InputMode: Dispatch<
    SetStateAction<"text" | "first-frame" | "first-last" | "multimodal">
  >;
  seedance2ReferenceImageUrls: string[];
  setSeedance2ReferenceImageUrls: Dispatch<SetStateAction<string[]>>;
  seedance2ReferenceVideoUrls: string[];
  setSeedance2ReferenceVideoUrls: Dispatch<SetStateAction<string[]>>;
  seedance2ReferenceAudioUrls: string[];
  setSeedance2ReferenceAudioUrls: Dispatch<SetStateAction<string[]>>;
  seedance2ReturnLastFrame: boolean;
  setSeedance2ReturnLastFrame: Dispatch<SetStateAction<boolean>>;
  seedance2WebSearch: boolean;
  setSeedance2WebSearch: Dispatch<SetStateAction<boolean>>;
  klingShotType: "customize" | "intelligent";
  setKlingShotType: Dispatch<SetStateAction<"customize" | "intelligent">>;
  klingVoiceIds: [string, string];
  setKlingVoiceIds: Dispatch<SetStateAction<[string, string]>>;
  klingMultiPrompts: { id: string; prompt: string; duration: number }[];
  setKlingMultiPrompts: Dispatch<
    SetStateAction<{ id: string; prompt: string; duration: number }[]>
  >;
  klingElements: AiStudioKlingElement[];
  setKlingElements: Dispatch<SetStateAction<AiStudioKlingElement[]>>;
  createIsGenerating: boolean;
  editIsGenerating: boolean;
  videoIsGenerating: boolean;
  setPanelGenerating: (panel: AiStudioSubmitPanelKey, value: boolean) => void;
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

export const useAiStudioCreationState = ({
  projectRouteRequested = false,
}: {
  projectRouteRequested?: boolean;
} = {}): UseAiStudioCreationStateResult => {
  const resolveStateAction = <T>(current: T, action: SetStateAction<T>): T =>
    typeof action === "function" ? (action as (value: T) => T)(current) : action;
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  const [mode, setMode] = useState<StudioMode>("text");
  const [aspect, setAspect] = useState<string>("9:16");
  const [model, setModelState] = useState<string | null>(null);
  const [standardPrompt, setStandardPrompt] = useState<string>("");
  const [pulsePrompt, setPulsePrompt] = useState<string>("");
  const [editReferenceText, setEditReferenceTextState] = useState<string>("");
  const [videoReferenceText, setVideoReferenceTextState] = useState<string>("");
  const [expertEditSessionState, setExpertEditSessionStateState] =
    useState<ExpertEditSessionState | null>(null);
  const expertEditSessionStateRef = useRef<ExpertEditSessionState | null>(expertEditSessionState);
  const [expertEditSessionRevision, setExpertEditSessionRevision] = useState<number>(0);
  const [videoReferenceMode, setVideoReferenceMode] = useState<
    "standard" | "modify" | "keyframes" | "kling3" | "motion"
  >("standard");
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number>(() =>
    projectRouteRequested ? 6 : readSessionStorageNumberPreference(VIDEO_DURATION_STORAGE_KEY, 6)
  );
  const [videoResolution, setVideoResolution] = useState<string>(() =>
    projectRouteRequested
      ? "1080p"
      : readSessionStorageStringPreference(VIDEO_RESOLUTION_STORAGE_KEY, "1080p")
  );
  const [imageResolution, setImageResolution] = useState<string>(() =>
    projectRouteRequested
      ? "model_default"
      : readSessionStorageStringPreference(IMAGE_RESOLUTION_STORAGE_KEY, "model_default")
  );
  const [hasUserVideoPrefs, setHasUserVideoPrefs] = useState<boolean>(
    projectRouteRequested ? false : hasStoredVideoPreferences
  );
  const [videoGenerateAudio, setVideoGenerateAudio] = useState<boolean>(false);
  const [videoCameraFixed, setVideoCameraFixed] = useState<boolean>(false);
  const [videoAutoFix, setVideoAutoFix] = useState<boolean>(false);
  const [klingNegativePrompt, setKlingNegativePrompt] = useState<string>(
    "blur, distort, and low quality"
  );
  const [klingCfgScale, setKlingCfgScale] = useState<number>(0.5);
  const [klingWorkflowMode, setKlingWorkflowMode] = useState<"single" | "multi" | "custom">(
    "single"
  );
  const [seedance2InputMode, setSeedance2InputMode] = useState<
    "text" | "first-frame" | "first-last" | "multimodal"
  >("text");
  const [seedance2ReferenceImageUrls, setSeedance2ReferenceImageUrls] = useState<string[]>([]);
  const [seedance2ReferenceVideoUrls, setSeedance2ReferenceVideoUrls] = useState<string[]>([]);
  const [seedance2ReferenceAudioUrls, setSeedance2ReferenceAudioUrls] = useState<string[]>([]);
  const [seedance2ReturnLastFrame, setSeedance2ReturnLastFrame] = useState<boolean>(false);
  const [seedance2WebSearch, setSeedance2WebSearch] = useState<boolean>(false);
  const [klingShotType, setKlingShotType] = useState<"customize" | "intelligent">("customize");
  const [klingVoiceIds, setKlingVoiceIds] = useState<[string, string]>(["", ""]);
  const [klingMultiPrompts, setKlingMultiPrompts] = useState<
    { id: string; prompt: string; duration: number }[]
  >([]);
  const [klingElements, setKlingElements] = useState<AiStudioKlingElement[]>([
    createEmptyAiStudioKlingElement(),
  ]);
  const [panelGeneratingState, setPanelGeneratingState] = useState<AiStudioPanelGeneratingState>({
    create: false,
    edit: false,
    video: false,
  });
  const [uiError, setUiError] = useState<string | null>(null);
  const [uiNotice, setUiNotice] = useState<string | null>(null);
  const lastVideoReferenceModeRef = useRef(videoReferenceMode);
  const lastNonKling3VideoModelRef = useRef<string | null>(null);
  const lastNonKeyframesVideoModelRef = useRef<string | null>(null);
  const lastNonMotionVideoModelRef = useRef<string | null>(null);
  const createIsGenerating = panelGeneratingState.create;
  const editIsGenerating = panelGeneratingState.edit;
  const videoIsGenerating = panelGeneratingState.video;

  const setPanelGenerating = (panel: AiStudioSubmitPanelKey, value: boolean) => {
    setPanelGeneratingState((prev) => {
      if (prev[panel] === value) return prev;
      return {
        ...prev,
        [panel]: value,
      };
    });
  };

  const updateExpertEditSessionState = useCallback(
    (
      action: SetStateAction<ExpertEditSessionState | null>,
      options?: { updateSeedState?: boolean }
    ) => {
      const nextState = resolveStateAction(expertEditSessionStateRef.current, action);
      const liveStateChanged = !Object.is(expertEditSessionStateRef.current, nextState);
      if (liveStateChanged) {
        expertEditSessionStateRef.current = nextState;
        setExpertEditSessionRevision((current) => current + 1);
      }
      if (options?.updateSeedState !== false) {
        setExpertEditSessionStateState((current) =>
          Object.is(current, nextState) ? current : nextState
        );
      }
    },
    []
  );

  const setExpertEditSessionState = useCallback<
    Dispatch<SetStateAction<ExpertEditSessionState | null>>
  >(
    (action) => {
      updateExpertEditSessionState(action, {
        updateSeedState: true,
      });
    },
    [updateExpertEditSessionState]
  );

  const publishExpertEditSessionState = useCallback<
    Dispatch<SetStateAction<ExpertEditSessionState | null>>
  >(
    (action) => {
      updateExpertEditSessionState(action, {
        updateSeedState: false,
      });
    },
    [updateExpertEditSessionState]
  );

  const getExpertEditSessionState = useCallback(() => expertEditSessionStateRef.current, []);

  return {
    promptRef,
    mode,
    setMode,
    aspect,
    setAspect,
    model,
    setModelState,
    standardPrompt,
    setStandardPrompt,
    pulsePrompt,
    setPulsePrompt,
    editReferenceText,
    setEditReferenceTextState,
    videoReferenceText,
    setVideoReferenceTextState,
    expertEditSessionState,
    setExpertEditSessionState,
    publishExpertEditSessionState,
    getExpertEditSessionState,
    expertEditSessionRevision,
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
    klingWorkflowMode,
    setKlingWorkflowMode,
    seedance2InputMode,
    setSeedance2InputMode,
    seedance2ReferenceImageUrls,
    setSeedance2ReferenceImageUrls,
    seedance2ReferenceVideoUrls,
    setSeedance2ReferenceVideoUrls,
    seedance2ReferenceAudioUrls,
    setSeedance2ReferenceAudioUrls,
    seedance2ReturnLastFrame,
    setSeedance2ReturnLastFrame,
    seedance2WebSearch,
    setSeedance2WebSearch,
    klingShotType,
    setKlingShotType,
    klingVoiceIds,
    setKlingVoiceIds,
    klingMultiPrompts,
    setKlingMultiPrompts,
    klingElements,
    setKlingElements,
    createIsGenerating,
    editIsGenerating,
    videoIsGenerating,
    setPanelGenerating,
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
