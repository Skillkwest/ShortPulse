/**
 * Create properties panel for AI Studio.
 * Handles prompt entry plus model/aspect controls for create workflows.
 */
import Image from "next/image";
import React, { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { CaretDown, X } from "phosphor-react";
import type { AspectOption, StudioMode } from "../../types";
import { aspectOptions, modelLogos } from "../../constants";
import type { ModelModalContext } from "../ModelModal";
import { AgentResponseInlineGenerateButton } from "../../../../prefabs/agent";
import type {
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
} from "../../../../prefabs/agent";
import { PromptStep } from "../PromptStep";
import { StandardCreateChatPanel } from "../promptStep/StandardCreateChatPanel";
import { StylesControl } from "../StylesControl";
import { resolveCreateModelModalContext } from "../../logic/createModelModalContext";
import { deriveCreateSelectorViewState } from "../../logic/createSelectorState";
import { getModelConfig } from "../../logic/modelRegistry";
import { StandardCreatePanelView } from "./StandardCreatePanelView";
import {
  getCreateCharacterInitials,
  type CreateCharacterOption,
  type CreateCharacterLookOption,
  useCreateCharacterModeController,
} from "./useCreateCharacterModeController";
import type { ExpertEditStyleTile } from "../edit/expertEditStyles";
import { useAvatarResilience } from "../../hooks/useAvatarResilience";
import {
  AiStudioPickerCard,
  AiStudioPickerFeedback,
  AiStudioPickerGrid,
  AiStudioPickerModalFrame,
} from "../picker/AiStudioPickerPrimitives";

export type { CreateMode } from "./createModeTypes";

export type StandardCreatePropertiesPanelProps = {
  mode: StudioMode;
  aspect: string;
  modelId: string | null;
  modelLabel: string;
  prompt: string;
  agentEnabled?: boolean;
  agentBootstrapPending?: boolean;
  agentMessages?: AgentMessage[];
  agentInput?: string;
  chatModeEnabled?: boolean;
  agentIsSending?: boolean;
  agentError?: string;
  stagedPrompt?: string | null;
  assistantBubbleMedia?: Record<string, AgentOutputBubbleMediaState>;
  stagedAttachments?: AgentAttachment[];
  agentDropActive?: boolean;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (
    anchorId: string,
    target: HTMLElement,
    context?: ModelModalContext | null
  ) => void;
  onPromptChange: (value: string) => void;
  costCredits?: number | null;
  isPromptGenerating?: boolean;
  isGenerateDisabled?: boolean;
  guardrailReason?: string | null;
  onStepActionClick?: (step: "character" | "model" | "prompt" | "imageSettings") => void;
  onAgentInputChange?: (value: string) => void;
  onChatModeEnabledChange?: (value: boolean) => void;
  onAgentSend?: () => void;
  onAgentAttachmentDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onRemoveAgentAttachment?: (id: string) => void;
  onClearAgentAttachments?: () => void;
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  onGenerate: () => void;
  onClearAgentChat?: () => void;
  imageResolution?: string;
  onImageResolutionChange?: (value: string) => void;
  characterOptions?: CreateCharacterOption[];
  selectedCharacterId?: string;
  selectedCharacterLookId?: string;
  selectedCharacterLookLabel?: string | null;
  onSelectedCharacterIdChange?: (characterId: string, lookId: string) => void;
  onCreateCharacter?: () => void;
  isCharacterOptionsLoading?: boolean;
  characterModeEnabled?: boolean;
  onCharacterModeEnabledChange?: (value: boolean) => void;
  refreshCharacterOptions?: () => Promise<
    Array<{ id: string; name: string; profileImageUrl: string | null }>
  >;
  loadCharacterLookOptions?: (characterId: string) => Promise<CreateCharacterLookOption[]>;
  resolveCharacterAvatarUrlById?: (characterId: string | null | undefined) => string | null;
  isStylesPanelOpen?: boolean;
  onStylesPanelToggle?: () => void;
  selectedStyleId?: string | null;
  stylesCatalog?: readonly ExpertEditStyleTile[];
  createModeToggle?: React.ReactNode;
  onOpenPresetsLibrary?: () => void;
};

type CharacterPickerModalProps = {
  isOpen: boolean;
  characterModeEnabled: boolean;
  isCharacterOptionsLoading: boolean;
  onClose: () => void;
  characterOptions: CreateCharacterOption[];
  selectedCharacterId: string;
  selectedCharacterLookId: string;
  onSelectedCharacterIdChange?: (characterId: string, lookId: string) => void;
  onCreateCharacter?: () => void;
  refreshCharacterOptions?: () => Promise<
    Array<{ id: string; name: string; profileImageUrl: string | null }>
  >;
  loadCharacterLookOptions?: (characterId: string) => Promise<CreateCharacterLookOption[]>;
  resolveCharacterAvatarUrlById?: (characterId: string | null | undefined) => string | null;
};

type CharacterLookDropdownProps = {
  characterName: string;
  value: string;
  options: CreateCharacterLookOption[];
  onChange: (value: string) => void;
};

const CharacterLookDropdown = ({
  characterName,
  value,
  options,
  onChange,
}: CharacterLookDropdownProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const listboxId = React.useId();
  const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties | null>(null);
  const selectedOption = React.useMemo(
    () => options.find((option) => option.id === value) ?? options[0] ?? null,
    [options, value]
  );

  const syncMenuPosition = React.useCallback(() => {
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (!triggerRect) return;
    setMenuStyle({
      position: "fixed",
      top: triggerRect.bottom + 6,
      left: triggerRect.left,
      width: triggerRect.width,
      zIndex: 1230,
    });
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideTrigger = dropdownRef.current?.contains(target) ?? false;
      const isInsideMenu = menuRef.current?.contains(target) ?? false;
      if (!isInsideTrigger && !isInsideMenu) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    const handleViewportChange = () => {
      syncMenuPosition();
    };

    syncMenuPosition();
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen, syncMenuPosition]);

  const isDisabled = options.length === 0;
  const label = `Choose look for ${characterName}`;
  const menu =
    isOpen && menuStyle
      ? createPortal(
          <div
            id={listboxId}
            ref={menuRef}
            className="ai-character-look-dropdown-menu"
            role="listbox"
            aria-label={label}
            style={menuStyle}
          >
            {options.map((option) => {
              const isActive = option.id === value;
              return (
                <button
                  type="button"
                  key={option.id}
                  className={`ai-character-look-dropdown-option${isActive ? " is-active" : ""}`}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                  }}
                >
                  <span className="ai-character-look-dropdown-option-label">{option.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="ai-character-look-dropdown" ref={dropdownRef}>
      <button
        type="button"
        ref={triggerRef}
        className={`ai-character-look-dropdown-trigger${isOpen ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={label}
        disabled={isDisabled}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="ai-character-look-dropdown-value">{selectedOption?.label ?? value}</span>
        <CaretDown
          size={16}
          weight="bold"
          className="ai-character-look-dropdown-caret"
          aria-hidden="true"
        />
      </button>
      {menu}
    </div>
  );
};

const EXPERT_CREATE_AGENT_INPUT_MAX_HEIGHT_PX = 520;

const CharacterPickerModal = ({
  isOpen,
  characterModeEnabled,
  isCharacterOptionsLoading,
  onClose,
  characterOptions,
  selectedCharacterId,
  selectedCharacterLookId,
  onSelectedCharacterIdChange,
  onCreateCharacter,
  refreshCharacterOptions,
  loadCharacterLookOptions,
  resolveCharacterAvatarUrlById,
}: CharacterPickerModalProps) => {
  const { resolveAvatarUrl, clearAvatarFailure, handleAvatarError } = useAvatarResilience({
    surfaceId: "create-character-picker-list",
  });
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);
  const [lookOptionsByCharacterId, setLookOptionsByCharacterId] = React.useState<
    Record<string, CreateCharacterLookOption[]>
  >({});
  const [lookLoadingByCharacterId, setLookLoadingByCharacterId] = React.useState<
    Record<string, boolean>
  >({});
  const [lookErrorByCharacterId, setLookErrorByCharacterId] = React.useState<
    Record<string, string | null>
  >({});
  const [pendingLookIdByCharacterId, setPendingLookIdByCharacterId] = React.useState<
    Record<string, string>
  >({});
  const refreshNow = React.useCallback(async () => {
    if (!refreshCharacterOptions) return;
    setRefreshError(null);
    setIsRefreshing(true);
    try {
      await refreshCharacterOptions();
    } catch {
      setRefreshError("Unable to refresh character profiles.");
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCharacterOptions]);
  const loadLooksForCharacter = React.useCallback(
    async (characterId: string) => {
      const normalizedCharacterId = characterId.trim();
      if (!loadCharacterLookOptions || !normalizedCharacterId) return [];
      setLookLoadingByCharacterId((current) => ({
        ...current,
        [normalizedCharacterId]: true,
      }));
      setLookErrorByCharacterId((current) => ({
        ...current,
        [normalizedCharacterId]: null,
      }));
      try {
        const nextOptions = await loadCharacterLookOptions(normalizedCharacterId);
        setLookOptionsByCharacterId((current) => ({
          ...current,
          [normalizedCharacterId]: nextOptions,
        }));
        setPendingLookIdByCharacterId((current) => {
          const currentPendingLookId = current[normalizedCharacterId]?.trim() ?? "";
          const selectedLookId =
            normalizedCharacterId === selectedCharacterId ? selectedCharacterLookId.trim() : "";
          const resolvedLookId = [currentPendingLookId, selectedLookId]
            .find((lookId) => nextOptions.some((option) => option.id === lookId))
            ?.trim();
          const fallbackLookId =
            nextOptions.find((option) => option.isDefault)?.id ?? nextOptions[0]?.id ?? "";
          const nextLookId = resolvedLookId || fallbackLookId;
          if (!nextLookId || current[normalizedCharacterId] === nextLookId) {
            return current;
          }
          return {
            ...current,
            [normalizedCharacterId]: nextLookId,
          };
        });
        return nextOptions;
      } catch {
        setLookErrorByCharacterId((current) => ({
          ...current,
          [normalizedCharacterId]: "Unable to load looks.",
        }));
        return [];
      } finally {
        setLookLoadingByCharacterId((current) => ({
          ...current,
          [normalizedCharacterId]: false,
        }));
      }
    },
    [loadCharacterLookOptions, selectedCharacterId, selectedCharacterLookId]
  );

  React.useEffect(() => {
    if (!isOpen || !characterModeEnabled) return;
    void refreshNow();
  }, [characterModeEnabled, isOpen, refreshNow]);
  React.useEffect(() => {
    if (!isOpen || !characterModeEnabled || !loadCharacterLookOptions) return;
    characterOptions.forEach((option) => {
      if (lookOptionsByCharacterId[option.id] || lookLoadingByCharacterId[option.id]) return;
      void loadLooksForCharacter(option.id);
    });
  }, [
    characterModeEnabled,
    characterOptions,
    isOpen,
    loadCharacterLookOptions,
    loadLooksForCharacter,
    lookLoadingByCharacterId,
    lookOptionsByCharacterId,
  ]);

  return (
    <AiStudioPickerModalFrame
      isOpen={isOpen}
      isEnabled={characterModeEnabled}
      activityId="create-character-picker-modal"
      ariaLabel="Choose character"
      title="Character Picker"
      subtitle="Choose a character and the look to use for this generation."
      onClose={onClose}
      headerActions={
        <div className="model-modal-header-actions">
          <button
            type="button"
            className="ai-character-picker-library-btn"
            onClick={() => {
              onClose();
              onCreateCharacter?.();
            }}
          >
            + Create Character
          </button>
          <button
            type="button"
            className="ghost-btn mini model-modal-close"
            aria-label="Close character picker"
            onClick={onClose}
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      }
    >
      {characterOptions.length > 0 ? (
        <AiStudioPickerGrid ariaLabel="Character options">
          {characterOptions.map((option) => {
            const isActive = option.id === selectedCharacterId;
            const lookOptions = lookOptionsByCharacterId[option.id] ?? [];
            const isLookLoading = Boolean(lookLoadingByCharacterId[option.id]);
            const lookError = lookErrorByCharacterId[option.id] ?? null;
            const showLookSelect = lookOptions.length > 1;
            const selectedLookIdForCard =
              pendingLookIdByCharacterId[option.id] ??
              (isActive ? selectedCharacterLookId.trim() : "") ??
              "";
            const resolvedAvatarUrl = resolveAvatarUrl(
              option.id,
              resolveCharacterAvatarUrlById?.(option.id) ?? option.profileImageUrl ?? null
            );
            return (
              <AiStudioPickerCard
                key={option.id}
                isActive={isActive}
                className="ai-character-picker-card--with-looks"
                onSelect={() => {
                  const fallbackLookId =
                    lookOptions.find((item) => item.isDefault)?.id ?? lookOptions[0]?.id ?? "";
                  onSelectedCharacterIdChange?.(
                    option.id,
                    selectedLookIdForCard || fallbackLookId || ""
                  );
                  onClose();
                }}
                avatar={
                  resolvedAvatarUrl ? (
                    <Image
                      src={resolvedAvatarUrl}
                      alt=""
                      className="ai-character-list-avatar-image"
                      width={44}
                      height={44}
                      unoptimized
                      onLoad={() => {
                        clearAvatarFailure(option.id);
                      }}
                      onError={() => {
                        void handleAvatarError({
                          avatarId: option.id,
                          recoverAvatarUrl: async () => {
                            const refreshedOptions = await refreshCharacterOptions?.();
                            const refreshedAvatarUrl =
                              refreshedOptions?.find((item) => item.id === option.id)
                                ?.profileImageUrl ?? null;
                            return (
                              refreshedAvatarUrl?.trim() ??
                              resolveCharacterAvatarUrlById?.(option.id) ??
                              null
                            );
                          },
                        });
                      }}
                    />
                  ) : (
                    <span className="ai-character-list-avatar-initials">
                      {getCreateCharacterInitials(option.name)}
                    </span>
                  )
                }
                label={isActive ? "Selected" : "Character"}
                name={option.name}
                footer={
                  isLookLoading ? (
                    <p className="ai-character-look-meta tiny subdued">Loading looks...</p>
                  ) : lookError ? (
                    <p className="ai-character-look-meta tiny">{lookError}</p>
                  ) : showLookSelect ? (
                    <div className="ai-character-look-field">
                      <span className="ai-character-look-label">Select look</span>
                      <CharacterLookDropdown
                        characterName={option.name}
                        value={selectedLookIdForCard}
                        options={lookOptions}
                        onChange={(nextLookId) => {
                          setPendingLookIdByCharacterId((current) => ({
                            ...current,
                            [option.id]: nextLookId,
                          }));
                          onSelectedCharacterIdChange?.(option.id, nextLookId);
                          onClose();
                        }}
                      />
                    </div>
                  ) : lookOptions.length === 1 ? (
                    <p className="ai-character-look-meta tiny subdued">
                      Look: {lookOptions[0]?.label}
                    </p>
                  ) : null
                }
              />
            );
          })}
        </AiStudioPickerGrid>
      ) : (
        <AiStudioPickerFeedback
          isLoading={isCharacterOptionsLoading || isRefreshing}
          loadingMessage="Loading character profiles..."
          errorMessage={refreshError}
          emptyMessage="No character profiles available."
          onRetry={() => void refreshNow()}
        />
      )}
    </AiStudioPickerModalFrame>
  );
};

/**
 * Renders the Create tool controls.
 */
export function StandardCreatePropertiesPanel({
  mode,
  aspect,
  modelId,
  modelLabel,
  prompt,
  isModelModalOpen,
  modelModalAnchor,
  onAspectChange,
  onModelPickerOpen,
  onPromptChange,
  costCredits = null,
  agentEnabled = false,
  agentBootstrapPending = false,
  agentMessages = [],
  agentInput = "",
  chatModeEnabled = false,
  agentIsSending = false,
  agentError,
  stagedPrompt = null,
  assistantBubbleMedia,
  stagedAttachments = [],
  agentDropActive = false,
  onStepActionClick,
  onAgentInputChange,
  onChatModeEnabledChange,
  onAgentSend,
  onAgentAttachmentDrop,
  onAgentAttachmentDragOver,
  onAgentAttachmentDragEnter,
  onAgentAttachmentDragLeave,
  onRemoveAgentAttachment,
  onClearAgentAttachments,
  onAssistantMessageEdit,
  isPromptGenerating = false,
  isGenerateDisabled = false,
  onClearAgentChat,
  imageResolution,
  onImageResolutionChange,
  characterOptions = [],
  selectedCharacterId = "",
  selectedCharacterLookId = "",
  selectedCharacterLookLabel = null,
  onSelectedCharacterIdChange,
  onCreateCharacter,
  isCharacterOptionsLoading = false,
  characterModeEnabled = true,
  onCharacterModeEnabledChange,
  refreshCharacterOptions,
  loadCharacterLookOptions,
  resolveCharacterAvatarUrlById,
  isStylesPanelOpen = false,
  onStylesPanelToggle,
  selectedStyleId = null,
  stylesCatalog,
  createModeToggle = null,
  onGenerate,
}: StandardCreatePropertiesPanelProps) {
  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;
  const effectiveModelLabel = modelLabel;
  const effectiveModelLogoSrc = modelLogoSrc;
  const useUnoptimizedModelLogo = false;
  const modelConfig = useMemo(() => (modelId ? getModelConfig(modelId) : null), [modelId]);
  const aspectOptionsForModel: AspectOption[] = useMemo(() => {
    if (modelConfig?.allowedAspects?.length) {
      return aspectOptions.filter((opt) => modelConfig.allowedAspects.includes(opt.value));
    }
    return aspectOptions;
  }, [modelConfig]);
  const { resolveAvatarUrl, clearAvatarFailure, handleAvatarError } = useAvatarResilience({
    surfaceId: "create-character-picker-trigger",
  });
  const handleCharacterPickerOpenRefresh = React.useCallback(() => {
    void refreshCharacterOptions?.();
  }, [refreshCharacterOptions]);
  const {
    isCharacterPickerOpen,
    openCharacterPicker,
    closeCharacterPicker,
    handleCharacterModeEnabledToggle,
    characterSelectDisabled,
    selectedCharacterName,
    selectedCharacterDisplayName,
    selectedCharacterProfileImageUrl,
    selectedCharacterInitials,
  } = useCreateCharacterModeController({
    characterModeEnabled,
    characterOptions,
    selectedCharacterId,
    selectedCharacterLookLabel,
    isCharacterOptionsLoading,
    onCharacterPickerOpen: handleCharacterPickerOpenRefresh,
    onCharacterModeEnabledChange,
    onStepActionClick,
  });
  const selectedCharacterAvatarUrl = resolveAvatarUrl(
    selectedCharacterId,
    resolveCharacterAvatarUrlById?.(selectedCharacterId) ?? selectedCharacterProfileImageUrl ?? null
  );
  const isCharacterSelectionEmpty = !selectedCharacterAvatarUrl && !selectedCharacterInitials;
  const handleSelectedCharacterAvatarError = React.useCallback(() => {
    void handleAvatarError({
      avatarId: selectedCharacterId,
      recoverAvatarUrl: async () => {
        const refreshedOptions = await refreshCharacterOptions?.();
        const refreshedAvatarUrl =
          refreshedOptions?.find((item) => item.id === selectedCharacterId)?.profileImageUrl ??
          null;
        return (
          refreshedAvatarUrl?.trim() ?? resolveCharacterAvatarUrlById?.(selectedCharacterId) ?? null
        );
      },
    });
  }, [
    handleAvatarError,
    refreshCharacterOptions,
    resolveCharacterAvatarUrlById,
    selectedCharacterId,
  ]);
  const handleSelectedCharacterAvatarLoad = React.useCallback(() => {
    clearAvatarFailure(selectedCharacterId);
  }, [clearAvatarFailure, selectedCharacterId]);

  const handleCreateModelOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    const context: ModelModalContext | null = resolveCreateModelModalContext({
      expertCreateMode: "standard",
      isCharacterModeEnabled: characterModeEnabled,
    });
    onModelPickerOpen("create-model", event.currentTarget, context);
    onStepActionClick?.("model");
  };

  const selectorViewState = useMemo(
    () =>
      deriveCreateSelectorViewState({
        mode,
        modelId,
        isModelModalOpen,
        modelModalAnchor,
        isGenerateDisabled,
        characterModeEnabled,
        selectedCharacterId,
        imageResolution,
      }),
    [
      characterModeEnabled,
      imageResolution,
      isGenerateDisabled,
      isModelModalOpen,
      mode,
      modelId,
      modelModalAnchor,
      selectedCharacterId,
    ]
  );
  const {
    imageResolutionOptions,
    imageResolutionValue,
    shouldShowImageResolutionCard,
    isModelSelectionEmpty,
    isCreateModelPickerOpen,
  } = selectorViewState;
  // Auto-clamp invalid image resolution values when switching image models.
  useEffect(() => {
    if (!onImageResolutionChange) return;
    if (imageResolutionValue !== imageResolution) {
      onImageResolutionChange(imageResolutionValue);
    }
  }, [imageResolution, imageResolutionValue, onImageResolutionChange]);

  const sharedPromptStepProps = {
    prompt,
    onPromptChange,
    agentEnabled,
    agentBootstrapPending,
    agentMessages,
    agentInput,
    agentIsSending,
    agentError,
    stagedPrompt,
    assistantBubbleMedia,
    stagedAttachments,
    agentDropActive,
    onAgentInputChange,
    chatModeEnabled,
    onChatModeEnabledChange,
    hideChatModeToggle: true,
    onAgentSend,
    onAgentAttachmentDrop,
    onAgentAttachmentDragOver,
    onAgentAttachmentDragEnter,
    onAgentAttachmentDragLeave,
    onRemoveAgentAttachment,
    onClearAgentAttachments,
    onClearAgentChat,
    onAssistantMessageEdit,
    isGenerating: isPromptGenerating,
    showGenerationThinkingInChat: false,
    chatOnly: true,
  } satisfies Omit<
    React.ComponentProps<typeof PromptStep>,
    "stepNumber" | "isCollapsed" | "onToggleCollapse"
  >;

  const promptStepProps: React.ComponentProps<typeof PromptStep> = {
    ...sharedPromptStepProps,
    stepNumber: "1",
    title: "Ask anything",
    subtitle: "",
    isCollapsed: false,
    onToggleCollapse: () => {
      // Standard Create keeps the chat composer always open.
    },
    className: `create-composer-prompt-step ${
      characterModeEnabled ? "is-character-mode-on" : "is-character-mode-off"
    }`,
    embedSendButtonInInput: true,
    hideAgentIntroMessage: true,
    agentAttachmentDropTarget: "input",
    hideInputDropHint: true,
    highlightLatestAssistantOnly: true,
    CreateChatPanel: StandardCreateChatPanel,
    chatComposerOverlayEnabled: true,
    stackTrailingComposerControls: true,
    agentInputMaxHeightPx: EXPERT_CREATE_AGENT_INPUT_MAX_HEIGHT_PX,
    agentInputCollapseOnBlur: true,
    hideChatModeToggle: false,
    composerLeadingContent: (
      <div className="create-composer-inline-leading-controls">
        <StylesControl
          isOpen={isStylesPanelOpen}
          selectedStyleId={selectedStyleId}
          styles={stylesCatalog}
          onToggle={onStylesPanelToggle}
        />
        <div className="create-composer-inline-generate">
          <AgentResponseInlineGenerateButton
            onClick={onGenerate}
            costCredits={costCredits}
            disabled={isGenerateDisabled}
          />
        </div>
      </div>
    ),
  };

  return (
    <>
      <StandardCreatePanelView
        promptStepProps={promptStepProps}
        characterModeEnabled={characterModeEnabled}
        onCharacterModeEnabledToggle={handleCharacterModeEnabledToggle}
        onCharacterPickerOpen={openCharacterPicker}
        characterSelectDisabled={characterSelectDisabled}
        isCharacterSelectionEmpty={isCharacterSelectionEmpty}
        selectedCharacterName={selectedCharacterName}
        selectedCharacterDisplayName={selectedCharacterDisplayName}
        selectedCharacterProfileImageUrl={selectedCharacterAvatarUrl}
        selectedCharacterInitials={selectedCharacterInitials}
        onSelectedCharacterAvatarError={handleSelectedCharacterAvatarError}
        onSelectedCharacterAvatarLoad={handleSelectedCharacterAvatarLoad}
        isCharacterPickerOpen={isCharacterPickerOpen}
        isCreateModelPickerOpen={isCreateModelPickerOpen}
        isModelSelectionEmpty={isModelSelectionEmpty}
        onCreateModelOpen={handleCreateModelOpen}
        effectiveModelLogoSrc={effectiveModelLogoSrc}
        useUnoptimizedModelLogo={useUnoptimizedModelLogo}
        effectiveModelLabel={effectiveModelLabel}
        aspect={aspect}
        aspectOptionsForModel={aspectOptionsForModel}
        onAspectChange={onAspectChange}
        shouldShowImageResolutionCard={shouldShowImageResolutionCard}
        imageResolutionValue={imageResolutionValue}
        imageResolutionOptions={imageResolutionOptions}
        onImageResolutionChange={(value) => {
          onImageResolutionChange?.(value);
          onStepActionClick?.("imageSettings");
        }}
        createModeToggle={createModeToggle}
      />
      <CharacterPickerModal
        isOpen={isCharacterPickerOpen}
        characterModeEnabled={characterModeEnabled}
        isCharacterOptionsLoading={isCharacterOptionsLoading}
        onClose={closeCharacterPicker}
        characterOptions={characterOptions}
        selectedCharacterId={selectedCharacterId}
        selectedCharacterLookId={selectedCharacterLookId}
        onSelectedCharacterIdChange={onSelectedCharacterIdChange}
        onCreateCharacter={onCreateCharacter}
        refreshCharacterOptions={refreshCharacterOptions}
        loadCharacterLookOptions={loadCharacterLookOptions}
        resolveCharacterAvatarUrlById={resolveCharacterAvatarUrlById}
      />
    </>
  );
}
