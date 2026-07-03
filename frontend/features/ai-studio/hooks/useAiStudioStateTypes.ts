/**
 * Option contracts for the AI Studio state facade.
 */
import type { Dispatch, SetStateAction } from "react";
import type { StudioOutput } from "../types";
import type { VoiceChangerSource } from "../components/VoiceChangerSourceDropzone";

export type AiStudioStateOptions = {
  projectId?: string | null;
  projectRouteRequested?: boolean;
  sessionId?: string | null;
  isCharacterModeEnabled?: boolean;
  selectedStylePrompt?: string | null;
  selectedStyleContext?: StudioOutput["styleContext"] | null;
  expertCreateMode?: "standard" | "pulse";
  activePulsePresetId?: string | null;
  pulseSessionInstanceId?: string | null;
  setExpertCreateMode?: Dispatch<SetStateAction<"standard" | "pulse">>;
  setActivePulsePresetId?: Dispatch<SetStateAction<string | null>>;
  setPulseSessionInstanceId?: Dispatch<SetStateAction<string | null>>;
  setVoiceChangerSource?: (source: VoiceChangerSource | null) => void;
  prepareCreateCharacterWorkflowReload?: (
    characterContext: StudioOutput["characterContext"] | null
  ) => void;
  prepareImageStyleWorkflowReload?: (styleContext: StudioOutput["styleContext"] | null) => void;
  prepareStandardCreateWorkflowReload?: (prompt: string) => void;
};
