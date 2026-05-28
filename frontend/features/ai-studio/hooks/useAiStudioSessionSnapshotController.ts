/**
 * AI Studio session snapshot controller.
 * Owns snapshot build/apply orchestration, including signed-url refresh for restored outputs.
 */
import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
  type MutableRefObject,
} from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import {
  type AiStudioSessionCreateModeReferenceStateV1,
  type AiStudioSessionCreateModeReferenceStatesV1,
  buildAiStudioSessionSnapshot,
  type AiStudioSessionAgentV1,
  type AiStudioSessionAgentRuntimesV2,
  type AiStudioSessionSnapshot,
  type AiStudioSessionSnapshotV2,
} from "../logic/sessionSnapshot";
import {
  buildAiStudioSessionHydrationPayload,
  type AiStudioSessionHydrationPayload,
} from "../logic/sessionSnapshotHydrator";
import {
  applySessionRestoreSignedUrls,
  buildSessionOutputSigningFingerprintById,
  resolveSessionRestoreReferenceSignedUrls,
  resolveSessionRestoreSignedMediaAuthority,
} from "../logic/sessionRestoreMediaSigning";
import { registerInternalMediaRefsForUrls } from "../logic/referenceInputInternalMediaRegistry";
import type { PulseWorkspaceState } from "../logic/pulseSessionState";
import type { ReferenceProjectionState } from "../reference-projections";
import type { StudioMode, StudioOutput, ToolId } from "../types";
import type { AiStudioKlingElement } from "../logic/klingElements";
import type { ExpertEditSessionState } from "../components/edit/expertEditSessionState";
import type { ReferenceSelectionAuthorityStateSeed } from "./useAiStudioReferenceSelectionState";

const isPlaceholderOnlyRestoredOutput = (output: StudioOutput): boolean => {
  const hasResultMedia =
    Array.isArray(output.resultUrls) &&
    output.resultUrls.some((value) => typeof value === "string" && value.trim().length > 0);
  return (
    !output.previewText?.trim() &&
    !output.previewUrl &&
    !output.previewPosterUrl &&
    !output.previewPosterStoragePath &&
    !output.previewStoragePath &&
    !output.fullStoragePath &&
    !hasResultMedia
  );
};

const SESSION_RESTORE_SIGN_RETRY_DELAY_MS = 1500;
const SESSION_RESTORE_SIGN_MAX_ATTEMPTS = 2;

const resolveReferenceUrlsFromInternalMediaRefs = async (
  primaryUrl: string | null,
  extraUrls: [string | null, string | null, string | null],
  refs: unknown
): Promise<{
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
}> => {
  const signedUrls = await resolveSessionRestoreReferenceSignedUrls(
    Array.isArray(refs) ? refs : []
  );
  return {
    referenceImageUrl: primaryUrl ?? signedUrls[0] ?? null,
    extraImageUrls: [
      extraUrls[0] ?? signedUrls[1] ?? null,
      extraUrls[1] ?? signedUrls[2] ?? null,
      extraUrls[2] ?? signedUrls[3] ?? null,
    ],
  };
};

type UseAiStudioSessionSnapshotControllerParams = {
  mode: StudioMode;
  selectedTool: ToolId | null;
  standardCreatePrompt: string;
  pulseCreatePrompt: string;
  model: string | null;
  aspect: string;
  pulseWorkspaceState: PulseWorkspaceState;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  editReferenceText: string;
  videoReferenceText: string;
  videoReferenceMode: "standard" | "modify" | "keyframes" | "kling3" | "motion";
  videoDurationSeconds: number;
  videoResolution: string;
  imageResolution: string;
  videoGenerateAudio: boolean;
  videoCameraFixed: boolean;
  videoAutoFix: boolean;
  klingNegativePrompt: string;
  klingCfgScale: number;
  klingWorkflowMode: "single" | "multi" | "custom";
  seedance2InputMode: "text" | "first-frame" | "first-last" | "multimodal";
  seedance2ReferenceImageUrls: string[];
  seedance2ReferenceVideoUrls: string[];
  seedance2ReferenceAudioUrls: string[];
  seedance2ReturnLastFrame: boolean;
  seedance2WebSearch: boolean;
  klingShotType: "customize" | "intelligent";
  klingVoiceIds: [string, string];
  klingMultiPrompts: { id: string; prompt: string; duration: number }[];
  klingElements: AiStudioKlingElement[];
  motionReferenceVideoUrl: string | null;
  outputs: StudioOutput[];
  archivedOutputs: StudioOutput[];
  activeOutputId: string | null;
  curatedReferenceIds: string[];
  removedFromAllRefsIds: string[];
  sessionHydrationSigningRevisionRef: MutableRefObject<number>;
  setMode: Dispatch<SetStateAction<StudioMode>>;
  setSelectedTool: Dispatch<SetStateAction<ToolId | null>>;
  setStandardCreatePrompt: (value: string) => void;
  setPulseCreatePrompt: (value: string) => void;
  setModel: (value: string | null) => void;
  setAspect: Dispatch<SetStateAction<string>>;
  setExpertCreateMode: Dispatch<SetStateAction<"standard" | "pulse">>;
  setActivePulsePresetId: Dispatch<SetStateAction<string | null>>;
  setPulseSessionInstanceId: Dispatch<SetStateAction<string | null>>;
  setReferenceImageUrl: (value: string | null) => void;
  setReferenceSelectionStateForCreateMode: (
    createMode: "standard" | "pulse",
    nextState: ReferenceSelectionAuthorityStateSeed
  ) => void;
  getReferenceSelectionStateForCreateMode: (
    createMode: "standard" | "pulse"
  ) => AiStudioSessionCreateModeReferenceStateV1;
  setExtraImageUrl: (index: number, value: string | null) => void;
  setEditReferenceText: (value: string) => void;
  setVideoReferenceText: (value: string) => void;
  setVideoReferenceMode: Dispatch<
    SetStateAction<"standard" | "modify" | "keyframes" | "kling3" | "motion">
  >;
  setVideoDurationSeconds: Dispatch<SetStateAction<number>>;
  setVideoResolution: Dispatch<SetStateAction<string>>;
  setImageResolution: Dispatch<SetStateAction<string>>;
  setVideoGenerateAudio: Dispatch<SetStateAction<boolean>>;
  setVideoCameraFixed: Dispatch<SetStateAction<boolean>>;
  setVideoAutoFix: Dispatch<SetStateAction<boolean>>;
  setKlingNegativePrompt: Dispatch<SetStateAction<string>>;
  setKlingCfgScale: Dispatch<SetStateAction<number>>;
  setKlingWorkflowMode: Dispatch<SetStateAction<"single" | "multi" | "custom">>;
  setSeedance2InputMode: Dispatch<
    SetStateAction<"text" | "first-frame" | "first-last" | "multimodal">
  >;
  setSeedance2ReferenceImageUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReferenceVideoUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReferenceAudioUrls: Dispatch<SetStateAction<string[]>>;
  setSeedance2ReturnLastFrame: Dispatch<SetStateAction<boolean>>;
  setSeedance2WebSearch: Dispatch<SetStateAction<boolean>>;
  setKlingShotType: Dispatch<SetStateAction<"customize" | "intelligent">>;
  setKlingVoiceIds: Dispatch<SetStateAction<[string, string]>>;
  setKlingMultiPrompts: Dispatch<
    SetStateAction<{ id: string; prompt: string; duration: number }[]>
  >;
  setKlingElements: Dispatch<SetStateAction<AiStudioKlingElement[]>>;
  setMotionReferenceVideoUrl: Dispatch<SetStateAction<string | null>>;
  setOutputCollectionsForCreateMode: (
    createMode: "standard" | "pulse",
    activeRows: StudioOutput[],
    archivedRows: StudioOutput[]
  ) => void;
  setOutputsState: Dispatch<SetStateAction<StudioOutput[]>>;
  setArchivedOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  setRuntimeUiStateForCreateMode: (
    createMode: "standard" | "pulse",
    nextState: {
      activeOutputId: string | null;
      referenceProjectionState: ReferenceProjectionState;
      saved: boolean;
    }
  ) => void;
};

/**
 * Returns session snapshot build/apply helpers used by AI Studio state and persistence controllers.
 */
export const useAiStudioSessionSnapshotController = ({
  mode,
  selectedTool,
  standardCreatePrompt,
  pulseCreatePrompt,
  model,
  aspect,
  pulseWorkspaceState,
  referenceImageUrl,
  extraImageUrls,
  editReferenceText,
  videoReferenceText,
  videoReferenceMode,
  videoDurationSeconds,
  videoResolution,
  imageResolution,
  videoGenerateAudio,
  videoCameraFixed,
  videoAutoFix,
  klingNegativePrompt,
  klingCfgScale,
  klingWorkflowMode,
  seedance2InputMode,
  seedance2ReferenceImageUrls,
  seedance2ReferenceVideoUrls,
  seedance2ReferenceAudioUrls,
  seedance2ReturnLastFrame,
  seedance2WebSearch,
  klingShotType,
  klingVoiceIds,
  klingMultiPrompts,
  klingElements,
  motionReferenceVideoUrl,
  outputs,
  archivedOutputs,
  activeOutputId,
  curatedReferenceIds,
  removedFromAllRefsIds,
  sessionHydrationSigningRevisionRef,
  setMode,
  setSelectedTool,
  setStandardCreatePrompt,
  setPulseCreatePrompt,
  setModel,
  setAspect,
  setExpertCreateMode,
  setActivePulsePresetId,
  setPulseSessionInstanceId,
  setReferenceImageUrl,
  setReferenceSelectionStateForCreateMode,
  getReferenceSelectionStateForCreateMode,
  setExtraImageUrl,
  setEditReferenceText,
  setVideoReferenceText,
  setVideoReferenceMode,
  setVideoDurationSeconds,
  setVideoResolution,
  setImageResolution,
  setVideoGenerateAudio,
  setVideoCameraFixed,
  setVideoAutoFix,
  setKlingNegativePrompt,
  setKlingCfgScale,
  setKlingWorkflowMode,
  setSeedance2InputMode,
  setSeedance2ReferenceImageUrls,
  setSeedance2ReferenceVideoUrls,
  setSeedance2ReferenceAudioUrls,
  setSeedance2ReturnLastFrame,
  setSeedance2WebSearch,
  setKlingShotType,
  setKlingVoiceIds,
  setKlingMultiPrompts,
  setKlingElements,
  setMotionReferenceVideoUrl,
  setOutputCollectionsForCreateMode,
  setOutputsState,
  setRuntimeUiStateForCreateMode,
}: UseAiStudioSessionSnapshotControllerParams) => {
  const restoreSigningRetryTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const activeCreatePrompt =
    pulseWorkspaceState.expertCreateMode === "pulse" ? pulseCreatePrompt : standardCreatePrompt;
  const editReferenceTextRef = useRef(editReferenceText);
  const videoReferenceTextRef = useRef(videoReferenceText);

  useEffect(
    () => () => {
      if (restoreSigningRetryTimerRef.current) {
        globalThis.clearTimeout(restoreSigningRetryTimerRef.current);
        restoreSigningRetryTimerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    editReferenceTextRef.current = editReferenceText;
  }, [editReferenceText]);

  useEffect(() => {
    videoReferenceTextRef.current = videoReferenceText;
  }, [videoReferenceText]);

  const hydrateFromSessionSnapshot = useCallback(
    (snapshot: AiStudioSessionSnapshot): AiStudioSessionHydrationPayload => {
      const payload = buildAiStudioSessionHydrationPayload(snapshot);
      const workspace = payload.workspace;
      const outputPayload = payload.outputs;
      const standardReferenceSelectionState = workspace.createModeReferenceStates?.standard ?? {
        selectedTool: workspace.expertCreateMode === "standard" ? workspace.selectedTool : "create",
        referenceImageUrl:
          workspace.expertCreateMode === "standard" ? workspace.referenceImageUrl : null,
        extraImageUrls:
          workspace.expertCreateMode === "standard" ? workspace.extraImageUrls : [null, null, null],
        referenceImageInternalMediaRefs:
          workspace.expertCreateMode === "standard"
            ? (workspace.referenceImageInternalMediaRefs ?? [])
            : [],
        motionReferenceVideoUrl:
          workspace.expertCreateMode === "standard" ? workspace.motionReferenceVideoUrl : null,
      };
      const pulseReferenceSelectionState = workspace.createModeReferenceStates?.pulse ?? {
        selectedTool: workspace.expertCreateMode === "pulse" ? workspace.selectedTool : "create",
        referenceImageUrl:
          workspace.expertCreateMode === "pulse" ? workspace.referenceImageUrl : null,
        extraImageUrls:
          workspace.expertCreateMode === "pulse" ? workspace.extraImageUrls : [null, null, null],
        referenceImageInternalMediaRefs:
          workspace.expertCreateMode === "pulse"
            ? (workspace.referenceImageInternalMediaRefs ?? [])
            : [],
        motionReferenceVideoUrl:
          workspace.expertCreateMode === "pulse" ? workspace.motionReferenceVideoUrl : null,
      };
      const placeholderOnlyRestoredCount = [
        ...outputPayload.active,
        ...outputPayload.archived,
      ].filter(isPlaceholderOnlyRestoredOutput).length;
      if (placeholderOnlyRestoredCount > 0) {
        addBreadcrumb({
          type: "ui",
          level: "warn",
          message: "ai_studio_project_restore_placeholder_only_outputs",
          data: {
            session_id: snapshot.sessionId,
            placeholder_only_output_count: placeholderOnlyRestoredCount,
            active_output_count: outputPayload.active.length,
            archived_output_count: outputPayload.archived.length,
          },
        });
      }

      setMode(workspace.mode);
      setReferenceSelectionStateForCreateMode("standard", standardReferenceSelectionState);
      setReferenceSelectionStateForCreateMode("pulse", pulseReferenceSelectionState);
      setSelectedTool(workspace.selectedTool);
      setStandardCreatePrompt(workspace.standardPrompt);
      setPulseCreatePrompt(workspace.pulsePrompt);
      setModel(workspace.model);
      setAspect(workspace.aspect);
      setExpertCreateMode(workspace.expertCreateMode);
      setActivePulsePresetId(workspace.activePulsePresetId);
      setPulseSessionInstanceId(workspace.pulseSessionInstanceId);
      setReferenceImageUrl(workspace.referenceImageUrl);
      workspace.extraImageUrls.forEach((url, index) => {
        setExtraImageUrl(index, url);
      });
      setEditReferenceText(workspace.editReferenceText);
      setVideoReferenceText(workspace.videoReferenceText);
      setVideoReferenceMode(workspace.videoReferenceMode);
      setVideoDurationSeconds(workspace.videoDurationSeconds);
      setVideoResolution(workspace.videoResolution);
      setImageResolution(workspace.imageResolution);
      setVideoGenerateAudio(workspace.videoGenerateAudio);
      setVideoCameraFixed(workspace.videoCameraFixed);
      setVideoAutoFix(workspace.videoAutoFix);
      setKlingNegativePrompt(workspace.klingNegativePrompt);
      setKlingCfgScale(workspace.klingCfgScale);
      setKlingWorkflowMode(workspace.klingWorkflowMode);
      setSeedance2InputMode(workspace.seedance2InputMode);
      setSeedance2ReferenceImageUrls(workspace.seedance2ReferenceImageUrls);
      setSeedance2ReferenceVideoUrls(workspace.seedance2ReferenceVideoUrls);
      setSeedance2ReferenceAudioUrls(workspace.seedance2ReferenceAudioUrls);
      setSeedance2ReturnLastFrame(workspace.seedance2ReturnLastFrame);
      setSeedance2WebSearch(workspace.seedance2WebSearch);
      setKlingShotType(workspace.klingShotType);
      setKlingVoiceIds(workspace.klingVoiceIds);
      setKlingMultiPrompts(workspace.klingMultiPrompts);
      setKlingElements(workspace.klingElements);
      setMotionReferenceVideoUrl(workspace.motionReferenceVideoUrl);
      registerInternalMediaRefsForUrls(
        [workspace.referenceImageUrl, ...workspace.extraImageUrls],
        workspace.referenceImageInternalMediaRefs ?? []
      );
      registerInternalMediaRefsForUrls(
        [
          standardReferenceSelectionState.referenceImageUrl,
          ...standardReferenceSelectionState.extraImageUrls,
        ],
        standardReferenceSelectionState.referenceImageInternalMediaRefs ?? []
      );
      registerInternalMediaRefsForUrls(
        [
          pulseReferenceSelectionState.referenceImageUrl,
          ...pulseReferenceSelectionState.extraImageUrls,
        ],
        pulseReferenceSelectionState.referenceImageInternalMediaRefs ?? []
      );

      const restoredReferenceProjectionState = {
        quickSlotIds: outputPayload.curatedReferenceIds,
        removedFromAllRefsIds: outputPayload.removedFromAllRefsIds,
      };
      setOutputCollectionsForCreateMode(
        workspace.expertCreateMode,
        outputPayload.active,
        outputPayload.archived
      );
      setRuntimeUiStateForCreateMode(workspace.expertCreateMode, {
        activeOutputId: outputPayload.activeOutputId,
        referenceProjectionState: restoredReferenceProjectionState,
        saved: false,
      });

      const signingRevision = sessionHydrationSigningRevisionRef.current + 1;
      sessionHydrationSigningRevisionRef.current = signingRevision;
      if (restoreSigningRetryTimerRef.current) {
        globalThis.clearTimeout(restoreSigningRetryTimerRef.current);
        restoreSigningRetryTimerRef.current = null;
      }
      const activeBaselineById = buildSessionOutputSigningFingerprintById(outputPayload.active);
      // Archived outputs are not rendered during restore; avoid signing their media in the hot path.
      const hydrationOutputs = outputPayload.active;
      void Promise.all([
        resolveReferenceUrlsFromInternalMediaRefs(
          workspace.referenceImageUrl,
          workspace.extraImageUrls,
          workspace.referenceImageInternalMediaRefs ?? []
        ),
        resolveReferenceUrlsFromInternalMediaRefs(
          standardReferenceSelectionState.referenceImageUrl,
          standardReferenceSelectionState.extraImageUrls,
          standardReferenceSelectionState.referenceImageInternalMediaRefs ?? []
        ),
        resolveReferenceUrlsFromInternalMediaRefs(
          pulseReferenceSelectionState.referenceImageUrl,
          pulseReferenceSelectionState.extraImageUrls,
          pulseReferenceSelectionState.referenceImageInternalMediaRefs ?? []
        ),
      ])
        .then(([restoredWorkspaceRefs, restoredStandardRefs, restoredPulseRefs]) => {
          if (sessionHydrationSigningRevisionRef.current !== signingRevision) return;
          registerInternalMediaRefsForUrls(
            [restoredWorkspaceRefs.referenceImageUrl, ...restoredWorkspaceRefs.extraImageUrls],
            workspace.referenceImageInternalMediaRefs ?? []
          );
          registerInternalMediaRefsForUrls(
            [restoredStandardRefs.referenceImageUrl, ...restoredStandardRefs.extraImageUrls],
            standardReferenceSelectionState.referenceImageInternalMediaRefs ?? []
          );
          registerInternalMediaRefsForUrls(
            [restoredPulseRefs.referenceImageUrl, ...restoredPulseRefs.extraImageUrls],
            pulseReferenceSelectionState.referenceImageInternalMediaRefs ?? []
          );
          setReferenceSelectionStateForCreateMode("standard", {
            ...standardReferenceSelectionState,
            referenceImageUrl: restoredStandardRefs.referenceImageUrl,
            extraImageUrls: restoredStandardRefs.extraImageUrls,
          });
          setReferenceSelectionStateForCreateMode("pulse", {
            ...pulseReferenceSelectionState,
            referenceImageUrl: restoredPulseRefs.referenceImageUrl,
            extraImageUrls: restoredPulseRefs.extraImageUrls,
          });
          setReferenceImageUrl(restoredWorkspaceRefs.referenceImageUrl);
          restoredWorkspaceRefs.extraImageUrls.forEach((url, index) => {
            setExtraImageUrl(index, url);
          });
        })
        .catch(() => undefined);
      const attemptRestoreSigning = (attemptIndex: number) => {
        void resolveSessionRestoreSignedMediaAuthority(hydrationOutputs)
          .then(({ signedByPath, recoveredAuthorityByOutputId }) => {
            if (sessionHydrationSigningRevisionRef.current !== signingRevision) return;
            restoreSigningRetryTimerRef.current = null;
            if (signedByPath.size === 0 && Object.keys(recoveredAuthorityByOutputId).length === 0) {
              return;
            }

            setOutputsState((rows) => {
              const patched = applySessionRestoreSignedUrls(rows, signedByPath, {
                baselineById: activeBaselineById,
                recoveredAuthorityById: recoveredAuthorityByOutputId,
              });
              return patched.changed ? patched.outputs : rows;
            });
          })
          .catch((error) => {
            if (sessionHydrationSigningRevisionRef.current !== signingRevision) return;
            const message = error instanceof Error ? error.message : "unknown_error";
            const hasRetryBudget = attemptIndex + 1 < SESSION_RESTORE_SIGN_MAX_ATTEMPTS;
            addBreadcrumb({
              type: "ui",
              level: "warn",
              message: hasRetryBudget
                ? "ai_studio_session_restore_sign_batch_retry_scheduled"
                : "ai_studio_session_restore_sign_batch_failed",
              data: {
                attempt: attemptIndex + 1,
                max_attempts: SESSION_RESTORE_SIGN_MAX_ATTEMPTS,
                error: message,
              },
            });
            if (!hasRetryBudget) return;
            restoreSigningRetryTimerRef.current = globalThis.setTimeout(() => {
              if (sessionHydrationSigningRevisionRef.current !== signingRevision) return;
              restoreSigningRetryTimerRef.current = null;
              attemptRestoreSigning(attemptIndex + 1);
            }, SESSION_RESTORE_SIGN_RETRY_DELAY_MS);
          });
      };

      attemptRestoreSigning(0);

      return payload;
    },
    [
      restoreSigningRetryTimerRef,
      sessionHydrationSigningRevisionRef,
      setActivePulsePresetId,
      setAspect,
      setEditReferenceText,
      setExpertCreateMode,
      setExtraImageUrl,
      setImageResolution,
      setKlingCfgScale,
      setKlingElements,
      setKlingMultiPrompts,
      setKlingNegativePrompt,
      setKlingWorkflowMode,
      setSeedance2InputMode,
      setSeedance2ReferenceAudioUrls,
      setSeedance2ReferenceImageUrls,
      setSeedance2ReferenceVideoUrls,
      setSeedance2ReturnLastFrame,
      setSeedance2WebSearch,
      setKlingShotType,
      setKlingVoiceIds,
      setMode,
      setModel,
      setMotionReferenceVideoUrl,
      setOutputCollectionsForCreateMode,
      setOutputsState,
      setPulseSessionInstanceId,
      setReferenceImageUrl,
      setReferenceSelectionStateForCreateMode,
      setRuntimeUiStateForCreateMode,
      setSelectedTool,
      setPulseCreatePrompt,
      setStandardCreatePrompt,
      setVideoAutoFix,
      setVideoCameraFixed,
      setVideoDurationSeconds,
      setVideoGenerateAudio,
      setVideoReferenceMode,
      setVideoReferenceText,
      setVideoResolution,
    ]
  );

  const buildSessionSnapshot = useCallback(
    ({
      sessionId,
      updatedAt,
      agentRuntime,
      agentRuntimes,
      expertEditSessionState,
    }: {
      sessionId: string;
      updatedAt?: string;
      agentRuntime: AiStudioSessionAgentV1;
      agentRuntimes?: AiStudioSessionAgentRuntimesV2;
      expertEditSessionState?: ExpertEditSessionState | null;
    }): AiStudioSessionSnapshotV2 =>
      buildAiStudioSessionSnapshot({
        sessionId,
        updatedAt,
        mode,
        selectedTool,
        prompt: activeCreatePrompt,
        standardCreatePrompt,
        pulseCreatePrompt,
        model,
        aspect,
        pulseWorkspaceState,
        createModeReferenceStates: {
          standard: getReferenceSelectionStateForCreateMode("standard"),
          pulse: getReferenceSelectionStateForCreateMode("pulse"),
        } satisfies AiStudioSessionCreateModeReferenceStatesV1,
        referenceImageUrl,
        extraImageUrls,
        editReferenceText: editReferenceTextRef.current,
        videoReferenceText: videoReferenceTextRef.current,
        videoReferenceMode,
        videoDurationSeconds,
        videoResolution,
        imageResolution,
        videoGenerateAudio,
        videoCameraFixed,
        videoAutoFix,
        klingNegativePrompt,
        klingCfgScale,
        klingWorkflowMode,
        seedance2InputMode,
        seedance2ReferenceImageUrls,
        seedance2ReferenceVideoUrls,
        seedance2ReferenceAudioUrls,
        seedance2ReturnLastFrame,
        seedance2WebSearch,
        klingShotType,
        klingVoiceIds,
        klingMultiPrompts,
        klingElements,
        motionReferenceVideoUrl,
        outputs,
        archivedOutputs,
        activeOutputId,
        curatedReferenceIds,
        removedFromAllRefsIds,
        agentMessages: agentRuntime.messages,
        agentInput: agentRuntime.input,
        latestAgentPrompt: agentRuntime.latestAgentPrompt,
        promptOrigin: agentRuntime.promptOrigin,
        chatModeEnabled: agentRuntime.chatModeEnabled,
        pulseWorkflowSession: agentRuntime.pulseWorkflowSession ?? null,
        agentRuntimes,
        expertEditSessionState,
      }),
    [
      activeOutputId,
      archivedOutputs,
      aspect,
      curatedReferenceIds,
      extraImageUrls,
      imageResolution,
      klingCfgScale,
      klingElements,
      klingMultiPrompts,
      klingNegativePrompt,
      klingWorkflowMode,
      seedance2InputMode,
      seedance2ReferenceAudioUrls,
      seedance2ReferenceImageUrls,
      seedance2ReferenceVideoUrls,
      seedance2ReturnLastFrame,
      seedance2WebSearch,
      klingShotType,
      klingVoiceIds,
      mode,
      model,
      motionReferenceVideoUrl,
      outputs,
      pulseCreatePrompt,
      pulseWorkspaceState,
      activeCreatePrompt,
      getReferenceSelectionStateForCreateMode,
      referenceImageUrl,
      removedFromAllRefsIds,
      selectedTool,
      standardCreatePrompt,
      videoAutoFix,
      videoCameraFixed,
      videoDurationSeconds,
      videoGenerateAudio,
      videoReferenceMode,
      videoResolution,
    ]
  );

  return {
    hydrateFromSessionSnapshot,
    buildSessionSnapshot,
  };
};
