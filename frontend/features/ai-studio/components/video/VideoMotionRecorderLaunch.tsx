/**
 * Motion Control recorder launch card for the Video workflow.
 */
import React from "react";
import { AiStudioRecordPanelPrefab } from "../AiStudioRecordPanelPrefab";

type VideoMotionRecorderLaunchProps = {
  onOpenMotionRecorder: () => void;
};

/**
 * Renders the optional motion-source recorder launcher.
 */
export function VideoMotionRecorderLaunch({
  onOpenMotionRecorder,
}: VideoMotionRecorderLaunchProps) {
  return (
    <div className="video-setup-recorder-slot">
      <div className="reference-dropzone-block motion-recorder-launch-block">
        <AiStudioRecordPanelPrefab
          panelAriaLabel="Record optional motion source"
          title="Need a clip?"
          helper="If you do not already have a motion video, you can record one here."
          buttonIdleAriaLabel="Open motion recorder to add a motion clip"
          buttonRecordingAriaLabel="Open motion recorder to add a motion clip"
          idleCue="Click to record"
          isRecording={false}
          onClick={onOpenMotionRecorder}
        />
      </div>
    </div>
  );
}
