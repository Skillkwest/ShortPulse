/**
 * Inline video settings step wrapper.
 * Delegates the UI to the isolated video settings prefab while preserving existing wiring.
 */
import React from "react";
import {
  VideoSettingsCardPrefab,
  type VideoSettingsResolutionOption,
} from "./VideoSettingsCardPrefab";
import type { AspectOption } from "../types";
import type { ModelModalContext } from "./ModelModal";

type ReferenceVideoSettingsStepProps = {
  isVideoVariant: boolean;
  isMotionMode: boolean;
  showMultiShotToggle?: boolean;
  multiShotEnabled?: boolean;
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
  isSeedanceModel: boolean;
  videoCameraFixed: boolean;
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
  onVideoCameraFixedChange?: (value: boolean) => void;
  onVideoAutoFixChange?: (value: boolean) => void;
  onToggleMultiShot?: () => void;
};

/**
 * Renders the video settings step in either inline-aside or ordered block form.
 */
export const ReferenceVideoSettingsStep: React.FC<ReferenceVideoSettingsStepProps> = ({
  isVideoVariant,
  isMotionMode,
  showMultiShotToggle = false,
  multiShotEnabled = false,
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
  isSeedanceModel,
  videoCameraFixed,
  isVeoModel,
  videoAutoFix,
  onAspectChange,
  onModelPickerOpen,
  showModelRow = true,
  inlineAside = false,
  onVideoDurationChange,
  onVideoResolutionChange,
  onVideoGenerateAudioChange,
  onVideoCameraFixedChange,
  onVideoAutoFixChange,
  onToggleMultiShot,
}) => {
  const settingsOrder = isMotionMode ? motionAudioOrder : videoSettingsOrder;

  if (!isVideoVariant) return null;

  const settingsContent = (
    <VideoSettingsCardPrefab
      showModelRow={showModelRow}
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
      showMultiShotToggle={showMultiShotToggle}
      multiShotEnabled={multiShotEnabled}
      isMotionMode={isMotionMode}
      isSeedanceModel={isSeedanceModel}
      videoCameraFixed={videoCameraFixed}
      isVeoModel={isVeoModel}
      videoAutoFix={videoAutoFix}
      onAspectChange={onAspectChange}
      onModelPickerOpen={onModelPickerOpen}
      onVideoDurationChange={onVideoDurationChange}
      onVideoResolutionChange={onVideoResolutionChange}
      onVideoGenerateAudioChange={onVideoGenerateAudioChange}
      onVideoCameraFixedChange={onVideoCameraFixedChange}
      onVideoAutoFixChange={onVideoAutoFixChange}
      onToggleMultiShot={onToggleMultiShot}
    />
  );

  if (inlineAside) {
    return <div className="video-settings-inline-aside">{settingsContent}</div>;
  }

  return (
    <div className="reference-dropzone-block" style={{ order: settingsOrder }}>
      {settingsContent}
    </div>
  );
};
