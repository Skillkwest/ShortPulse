/**
 * Mode-owned Create runtime contracts.
 * Defines the hard boundary between Standard Create and Pulse Create so runtime
 * extraction does not recreate a shared Standard/Pulse prop bag.
 */
import type { Dispatch, DragEvent, SetStateAction } from "react";
import type {
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
  AgentOutputGenerateInput,
  AgentPulseWorkflowSession,
} from "../../../prefabs/agent";
import type { ModelModalContext } from "../components/ModelModal";
import type {
  CreatePulsePresetKind,
  CreatePulsePresetStartResult,
  CreatePulseResolvedPreset,
} from "../components/create/createPulsePresets";
import type { CreatePulsePreferenceRuntimeValue } from "../components/create/createPulsePreferenceRuntime";
import type {
  CreateCharacterLookOption,
  CreateCharacterOption,
} from "../components/create/useCreateCharacterModeController";
import type { PulseCreatePropertiesPanelProps } from "../components/create/PulseCreatePropertiesPanel";
import type { StandardCreatePropertiesPanelProps } from "../components/create/StandardCreatePropertiesPanel";
import type { ExpertEditStyleTile } from "../components/edit/expertEditStyles";
import type { StudioMode, StudioOutput, ToolId } from "../types";
import type { AiStudioSessionAgentV1 } from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import type { PromptOrigin } from "../logic/agentPromptOwnership";
import type { AiStudioPulsePresetChangeOptions } from "../hooks/useAiStudioCreateModeRuntime";

export type NeutralCreateGenerationServices = {
  handleGenerate: (
    promptOverride?: string | null,
    options?: {
      modeOverride?: StudioMode;
      toolOverride?: ToolId | null;
      costOverrideCredits?: number | null;
      suppressStyle?: boolean;
    }
  ) => void | Promise<unknown>;
};

export type StandardCreateAgentRuntimeState = {
  agentEnabled: boolean;
  agentBootstrapReady: boolean;
  agentMessages: AgentMessage[];
  agentInput: string;
  chatModeEnabled: boolean;
  agentBusy: boolean;
  agentIsSending: boolean;
  agentUiBusy: boolean;
  agentAttachmentError: string | null;
  agentError?: string | null;
  stagedAgentPrompt?: string | null;
  assistantBubbleMedia?: Record<string, AgentOutputBubbleMediaState>;
  agentAttachments: AgentAttachment[];
  isAgentDropActive: boolean;
  persistedAgentRuntime: AiStudioSessionAgentV1;
};

export type StandardCreateAgentRuntimeActions = {
  onAgentInputChange: (value: string) => void;
  onChatModeChange: (value: boolean) => void;
  onAgentSend: () => void;
  onAgentAttachmentDrop: (event: DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onRemoveAgentAttachment: (id: string) => void;
  onClearAgentAttachments: () => void;
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  onClearAgentChat: () => void;
  onPrimarySubmit: () => void;
};

export type StandardCreateRuntimeProps = {
  prompt: string;
  mode: StudioMode;
  selectedTool: ToolId | null;
  aspect: string;
  model: string | null;
  currentModelLabel: string;
  createIsGenerating: boolean;
  isPromptRefining: boolean;
  describeInFlightCount: number;
  createGenerateCostCredits: number | null;
  promptReferenceGenerateCostCredits: number | null;
  hasSufficientCreditsForPromptReferenceGenerate: boolean;
  isGenerateDisabled: boolean;
  disableAgentOutputGenerate?: boolean;
  generationGuardrail: string | null;
  useReferenceImageIndicator: boolean;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  characterOptions: CreateCharacterOption[];
  selectedCharacterId: string;
  selectedCharacterLookId?: string;
  selectedCharacterLookLabel?: string | null;
  isCharacterOptionsLoading: boolean;
  isCharacterModeEnabled: boolean;
  imageResolution: string;
  isStylesPanelOpen?: boolean;
  selectedStyleId?: string | null;
  stylesCatalog?: readonly ExpertEditStyleTile[];
  onPromptChange: (value: string) => void;
  onGenerateOutputPrompt?: (request: AgentOutputGenerateInput) => void;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (
    anchorId: string,
    target: HTMLElement,
    context?: ModelModalContext | null
  ) => void;
  onSelectedCharacterChange: (characterId: string, lookId: string) => void;
  onOpenCharacterLibrary?: () => void;
  onCharacterModeChange: Dispatch<SetStateAction<boolean>>;
  onRefreshCharacterOptions?: () => Promise<
    Array<{ id: string; name: string; profileImageUrl: string | null }>
  >;
  onLoadCharacterLookOptions?: (characterId: string) => Promise<CreateCharacterLookOption[]>;
  resolveCharacterAvatarUrlById?: (characterId: string | null | undefined) => string | null;
  onImageResolutionChange: Dispatch<SetStateAction<string>>;
  onStylesPanelToggle?: () => void;
  onOpenPresetsLibrary?: () => void;
  generationServices: NeutralCreateGenerationServices;
};

export type StandardCreateRuntimeResult = {
  kind: "standard";
  panelProps: StandardCreatePropertiesPanelProps;
  agentRuntime: StandardCreateAgentRuntimeState;
  actions: StandardCreateAgentRuntimeActions;
};

export type StandardCreatePageAgentRuntime = StandardCreateAgentRuntimeState & {
  kind: "standard";
  linkedPromptReferenceIds: string[];
  latestAgentPrompt: string | null;
  promptOrigin: PromptOrigin;
  setPromptOrigin: Dispatch<SetStateAction<PromptOrigin>>;
  isPromptRefining: boolean;
  isReferencePromptEnhancing: false;
  describeInFlightCount: number;
  setChatModeEnabled: (value: boolean) => void;
  handleAgentInputChange: (value: string) => void;
  handleAgentSend: (
    textOverride?: string,
    options?: { captureResult?: boolean; selectedOverride?: StudioOutput | null }
  ) => Promise<{ prompt: string; referenceTitle?: string | null } | void>;
  handleAgentAttachmentDrop: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragOver: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  handleRemoveAgentAttachment: (id: string) => void;
  handleClearAgentAttachments: () => void;
  handleAssistantMessageEdit: (request: AgentAssistantMessageEditRequest) => boolean;
  handleClearAgentChat: () => void;
  hydrateFromSessionAgentSnapshot: (
    payload: Pick<AiStudioSessionHydrationPayload, "workspace" | "agent" | "agentRuntimes">
  ) => void;
  resetProjectAgentConversation: () => void;
};

export type PulseCreateAgentRuntimeState = {
  agentEnabled: boolean;
  agentBootstrapReady: boolean;
  agentMessages: AgentMessage[];
  agentInput: string;
  agentBusy: boolean;
  agentIsSending: boolean;
  agentUiBusy: boolean;
  agentAttachmentError: string | null;
  agentError?: string | null;
  stagedAgentPrompt?: string | null;
  agentAttachments: AgentAttachment[];
  isAgentDropActive: boolean;
  workflowSession: AgentPulseWorkflowSession | null;
  persistedAgentRuntime: AiStudioSessionAgentV1;
};

export type PulseCreateAgentRuntimeActions = {
  onAgentInputChange: (value: string) => void;
  onAgentSend: () => void;
  onAgentAttachmentDrop: (event: DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onRemoveAgentAttachment: (id: string) => void;
  onClearAgentAttachments: () => void;
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  onClearAgentChat: () => void;
  onGenerateArtifact: () => void;
  onPresetStart: (
    preset: CreatePulseResolvedPreset,
    options?: { pulseSessionInstanceId?: string | null; deferWorkflowSessionCommit?: boolean }
  ) => Promise<CreatePulsePresetStartResult>;
};

export type PulseCreateRuntimeProps = {
  pulsePrompt: string;
  hasActiveSession: boolean;
  activePresetId: string | null;
  activePresetLabel: string | null;
  activePresetKind: CreatePulsePresetKind | null;
  workflowSession: AgentPulseWorkflowSession | null;
  createIsGenerating: boolean;
  currentCostCredits: number | null;
  isGenerateDisabled: boolean;
  generationGuardrail: string | null;
  onPulsePromptChange: (value: string) => void;
  onActivePresetIdChange: (
    nextPresetId: string | null,
    options?: AiStudioPulsePresetChangeOptions
  ) => string | null | void;
  pulsePreferenceRuntime?: CreatePulsePreferenceRuntimeValue;
  generationServices: NeutralCreateGenerationServices;
};

export type PulseCreateRuntimeResult = {
  kind: "pulse";
  panelProps: PulseCreatePropertiesPanelProps;
  agentRuntime: PulseCreateAgentRuntimeState;
  actions: PulseCreateAgentRuntimeActions;
};

export type PulseCreatePageAgentRuntime = PulseCreateAgentRuntimeState & {
  kind: "pulse";
  linkedPromptReferenceIds: string[];
  latestAgentPrompt: string | null;
  promptOrigin: PromptOrigin;
  setPromptOrigin: Dispatch<SetStateAction<PromptOrigin>>;
  isPromptRefining: false;
  isReferencePromptEnhancing: false;
  describeInFlightCount: 0;
  handleAgentInputChange: (value: string) => void;
  handleAgentSend: (
    textOverride?: string,
    options?: { captureResult?: boolean; selectedOverride?: StudioOutput | null }
  ) => Promise<{ prompt: string; referenceTitle?: string | null } | void>;
  handlePulsePresetStart: (
    preset: CreatePulseResolvedPreset,
    options?: { pulseSessionInstanceId?: string | null; deferWorkflowSessionCommit?: boolean }
  ) => Promise<CreatePulsePresetStartResult>;
  handlePulsePresetRestart: (preset: CreatePulseResolvedPreset) => Promise<void>;
  handleAgentAttachmentDrop: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragOver: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  handleAgentAttachmentDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  handleRemoveAgentAttachment: (id: string) => void;
  handleClearAgentAttachments: () => void;
  handleAssistantMessageEdit: (request: AgentAssistantMessageEditRequest) => boolean;
  handleClearAgentChat: () => void;
  hydrateFromSessionAgentSnapshot: (
    payload: Pick<AiStudioSessionHydrationPayload, "workspace" | "agent" | "agentRuntimes">
  ) => void;
  resetProjectAgentConversation: () => void;
};

export type CreatePageAgentRuntime = StandardCreatePageAgentRuntime | PulseCreatePageAgentRuntime;
