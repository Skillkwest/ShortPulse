/**
 * Inline video settings step wrapper.
 * Delegates the UI to the isolated video settings prefab while preserving existing wiring.
 */
import React from "react";
import {
  VideoSettingsCardPrefab,
  type VideoSettingsResolutionOption,
} from "./VideoSettingsCardPrefab";
import styles from "../../../styles/ai-studio-video-settings-prefab.module.css";
import type { AspectOption } from "../types";
import type { ModelModalContext } from "./ModelModal";

type ReferenceVideoSettingsStepProps = {
  isVideoVariant: boolean;
  isMotionMode: boolean;
  multiShotShotCount?: number;
  modelId: string | null;
  modelLabel: string;
  modelLogoSrc?: string;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  modelModalContext?: ModelModalContext | null;
  aspect: string;
  aspectOptionsForModel: AspectOption[];
  videoSettingsOrder: number;
  motionAudioOrder: number;
  videoDurationValue: number;
  videoResolutionValue: string;
  durationOptions: number[];
  resolutionOptions: VideoSettingsResolutionOption[];
  videoGenerateAudioValue: boolean;
  isVeoModel: boolean;
  videoAutoFix: boolean;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (
    anchorId: string,
    target: HTMLElement,
    context?: ModelModalContext | null
  ) => void;
  showModelRow?: boolean;
  inlineAside?: boolean;
  onVideoDurationChange?: (value: number) => void;
  onVideoResolutionChange?: (value: string) => void;
  onVideoGenerateAudioChange?: (value: boolean) => void;
  onVideoAutoFixChange?: (value: boolean) => void;
};

/**
 * Renders the video settings step in either inline-aside or ordered block form.
 */
export const ReferenceVideoSettingsStep: React.FC<ReferenceVideoSettingsStepProps> = ({
  isVideoVariant,
  isMotionMode,
  modelId,
  modelLabel,
  modelLogoSrc,
  isModelModalOpen,
  modelModalAnchor,
  modelModalContext = "reference-video",
  aspect,
  aspectOptionsForModel,
  videoSettingsOrder,
  motionAudioOrder,
  videoDurationValue,
  videoResolutionValue,
  durationOptions,
  resolutionOptions,
  videoGenerateAudioValue,
  isVeoModel,
  videoAutoFix,
  onAspectChange,
  onModelPickerOpen,
  showModelRow = true,
  inlineAside = false,
  onVideoDurationChange,
  onVideoResolutionChange,
  onVideoGenerateAudioChange,
  onVideoAutoFixChange,
}) => {
  const settingsOrder = isMotionMode ? motionAudioOrder : videoSettingsOrder;
  const shouldShowModelRow = showModelRow && !isMotionMode;

  if (!isVideoVariant) return null;

  const settingsContent = (
    <VideoSettingsCardPrefab
      showModelRow={shouldShowModelRow}
      modelId={modelId}
      modelLabel={modelLabel}
      modelLogoSrc={modelLogoSrc}
      isModelModalOpen={isModelModalOpen}
      modelModalAnchor={modelModalAnchor}
      modelModalContext={modelModalContext}
      aspect={aspect}
      aspectOptionsForModel={aspectOptionsForModel}
      videoDurationValue={videoDurationValue}
      videoResolutionValue={videoResolutionValue}
      durationOptions={durationOptions}
      resolutionOptions={resolutionOptions}
      videoGenerateAudioValue={videoGenerateAudioValue}
      isMotionMode={isMotionMode}
      isVeoModel={isVeoModel}
      videoAutoFix={videoAutoFix}
      onAspectChange={onAspectChange}
      onModelPickerOpen={onModelPickerOpen}
      onVideoDurationChange={onVideoDurationChange}
      onVideoResolutionChange={onVideoResolutionChange}
      onVideoGenerateAudioChange={onVideoGenerateAudioChange}
      onVideoAutoFixChange={onVideoAutoFixChange}
    />
  );

  if (inlineAside) {
    return (
      <div className={`video-settings-inline-aside ${styles.bootstrapStyleScope}`}>
        {settingsContent}
      </div>
    );
  }

  return (
    <div className="reference-dropzone-block" style={{ order: settingsOrder }}>
      {settingsContent}
    </div>
  );
};
