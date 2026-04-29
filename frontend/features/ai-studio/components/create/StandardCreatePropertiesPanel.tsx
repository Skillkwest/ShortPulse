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
import { AgentGenerateButton } from "../../../../prefabs/agent";
import type {
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
  AgentOutputGenerateInput,
} from "../../../../prefabs/agent";
import { PromptStep } from "../PromptStep";
import { StandardCreateChatPanel } from "../promptStep/StandardCreateChatPanel";
import { StylesControl } from "../StylesControl";
import { deriveCreateSelectorViewState } from "../../logic/createSelectorState";
import { getModelConfig } from "../../logic/modelRegistry";
import { BeginnerCreatePanelView } from "./BeginnerCreatePanelView";
import { StandardCreatePanelView } from "./StandardCreatePanelView";
import type { ExpertCreateMode } from "./createModeTypes";
import {
  getCreateCharacterInitials,
  type CreateCharacterOption,
  type CreateCharacterLookOption,
  useCreateCharacterModeController,
} from "./useCreateCharacterModeController";
import type { ExpertEditStyleTile } from "../edit/expertEditStyles";
import { useAvatarResilience } from "../../hooks/useAvatarResilience";
import { AiStudioModalLayer, useAiStudioModalActivity } from "../modal-layer/AiStudioModalLayer";

export type { ExpertCreateMode } from "./createModeTypes";

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
  directOpenAiBypassEnabled?: boolean;
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
  isChatOffInlineGenerateDisabled?: boolean;
  outputGenerateCostCredits?: number | null;
  hasSufficientCreditsForOutputGenerate?: boolean;
  guardrailReason?: string | null;
  onExpandChat?: () => void;
  onStepActionClick?: (step: "character" | "model" | "prompt" | "imageSettings") => void;
  agentChatOpen?: boolean;
  onAgentInputChange?: (value: string) => void;
  onChatModeEnabledChange?: (value: boolean) => void;
  onAgentSend?: () => void;
  onAgentEnhanceSend?: () => void;
  onAgentAttachmentDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onRemoveAgentAttachment?: (id: string) => void;
  onClearAgentAttachments?: () => void;
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  onGenerateFromAgentOutputPrompt?: (request: AgentOutputGenerateInput) => void;
  onGenerate: () => void;
  onChatOffInlineGenerate: () => void;
  onSavePrompt: (customPrompt?: string) => void;
  shouldDisableSave?: boolean;
  onClearAgentChat?: () => void;
  beginnerMode?: boolean;
  expertCreateUiEligible?: boolean;
  imageResolution?: string;
  onImageResolutionChange?: (value: string) => void;
  characterOptions?: CreateCharacterOption[];
  selectedCharacterId?: string;
  selectedCharacterLookId?: string;
  selectedCharacterLookLabel?: string | null;
  onSelectedCharacterIdChange?: (characterId: string, lookId: string) => void;
  onOpenCharacterLibrary?: () => void;
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
  expertCreateMode?: ExpertCreateMode;
  onExpertCreateModeChange?: (value: ExpertCreateMode) => void;
  onOpenPresetsLibrary?: () => void;
};

type ComposeSendCardProps = {
  agentEnabled?: boolean;
  agentError?: string;
  onGenerate: () => void;
  costCredits?: number | null;
  isPromptGenerating?: boolean;
  isGenerateDisabled?: boolean;
  guardrailReason?: string | null;
  beginnerMode?: boolean;
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
  onOpenCharacterLibrary?: () => void;
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
  onOpenCharacterLibrary,
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
  useAiStudioModalActivity("create-character-picker-modal", isOpen && characterModeEnabled);

  if (!isOpen || !characterModeEnabled) {
    return null;
  }

  return (
    <AiStudioModalLayer>
      <>
        <div className="model-modal-backdrop ai-character-picker-backdrop" onClick={onClose} />
        <div
          className="model-modal ai-character-picker-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Choose character"
        >
          <div className="model-modal-header">
            <div className="model-modal-title-group">
              <h3 className="model-modal-title">Character Picker</h3>
              <p className="model-modal-subtitle">
                Choose a character and the look to use for this generation.
              </p>
            </div>
            <div className="model-modal-header-actions">
              <button
                type="button"
                className="ai-character-picker-library-btn"
                onClick={() => {
                  onClose();
                  onOpenCharacterLibrary?.();
                }}
              >
                Open Character Library
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
          </div>
          <div className="model-modal-scroll">
            {characterOptions.length > 0 ? (
              <div className="ai-character-picker-grid" role="list" aria-label="Character options">
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
                    <article
                      key={option.id}
                      role="listitem"
                      className={`ai-character-list-card ai-character-picker-card ai-character-picker-card--with-looks ${
                        isActive ? "is-active" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="ai-character-list-select-btn"
                        aria-pressed={isActive}
                        onClick={() => {
                          const fallbackLookId =
                            lookOptions.find((item) => item.isDefault)?.id ??
                            lookOptions[0]?.id ??
                            "";
                          onSelectedCharacterIdChange?.(
                            option.id,
                            selectedLookIdForCard || fallbackLookId || ""
                          );
                          onClose();
                        }}
                      >
                        <div className="ai-character-list-main">
                          <span className="ai-character-list-avatar" aria-hidden="true">
                            {resolvedAvatarUrl ? (
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
                            )}
                          </span>
                          <div className="ai-character-list-copy">
                            <p className="metric-label tiny">
                              {isActive ? "Selected" : "Character"}
                            </p>
                            <p className="ai-character-list-name">{option.name}</p>
                          </div>
                        </div>
                      </button>
                      {isLookLoading ? (
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
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : isCharacterOptionsLoading || isRefreshing ? (
              <p className="tiny subdued ai-character-picker-empty">
                Loading character profiles...
              </p>
            ) : refreshError ? (
              <div className="ai-character-picker-empty">
                <p className="tiny">{refreshError}</p>
                <button type="button" className="ghost-btn mini" onClick={() => void refreshNow()}>
                  Retry
                </button>
              </div>
            ) : (
              <p className="tiny subdued ai-character-picker-empty">
                No character profiles available.
              </p>
            )}
          </div>
        </div>
      </>
    </AiStudioModalLayer>
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
  chatModeEnabled = true,
  directOpenAiBypassEnabled = false,
  agentIsSending = false,
  agentError,
  stagedPrompt = null,
  assistantBubbleMedia,
  stagedAttachments = [],
  agentDropActive = false,
  onExpandChat,
  onStepActionClick,
  onAgentInputChange,
  onChatModeEnabledChange,
  onAgentSend,
  onAgentEnhanceSend,
  onAgentAttachmentDrop,
  onAgentAttachmentDragOver,
  onAgentAttachmentDragEnter,
  onAgentAttachmentDragLeave,
  onRemoveAgentAttachment,
  onClearAgentAttachments,
  onAssistantMessageEdit,
  onGenerateFromAgentOutputPrompt,
  agentChatOpen = false,
  onSavePrompt,
  shouldDisableSave = false,
  isPromptGenerating = false,
  isGenerateDisabled = false,
  isChatOffInlineGenerateDisabled = false,
  outputGenerateCostCredits = null,
  hasSufficientCreditsForOutputGenerate = true,
  onClearAgentChat,
  beginnerMode = false,
  expertCreateUiEligible = false,
  imageResolution,
  onImageResolutionChange,
  characterOptions = [],
  selectedCharacterId = "",
  selectedCharacterLookId = "",
  selectedCharacterLookLabel = null,
  onSelectedCharacterIdChange,
  onOpenCharacterLibrary,
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
  expertCreateMode,
  onExpertCreateModeChange,
  onGenerate,
  onChatOffInlineGenerate,
  guardrailReason,
}: StandardCreatePropertiesPanelProps) {
  const showExpertView = Boolean(expertCreateUiEligible && !beginnerMode);
  const [uncontrolledExpertCreateMode, setUncontrolledExpertCreateMode] =
    React.useState<ExpertCreateMode>("standard");
  const resolvedExpertCreateMode = expertCreateMode ?? uncontrolledExpertCreateMode;
  const handleExpertCreateModeChange = React.useCallback(
    (value: ExpertCreateMode) => {
      setUncontrolledExpertCreateMode(value);
      onExpertCreateModeChange?.(value);
    },
    [onExpertCreateModeChange]
  );
  const promptStepNumber = beginnerMode ? "2" : "1";
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
  const [collapsedSteps, setCollapsedSteps] = React.useState<{
    model: boolean;
    prompt: boolean;
  }>({
    model: false,
    prompt: false,
  });
  const { resolveAvatarUrl, clearAvatarFailure, handleAvatarError } = useAvatarResilience({
    surfaceId: "create-character-picker-trigger",
  });
  const handleCharacterPickerOpenRefresh = React.useCallback(() => {
    void refreshCharacterOptions?.();
  }, [refreshCharacterOptions]);
  const {
    characterStepSubtitle,
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
    beginnerMode,
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

  const toggleStep = (step: "model" | "prompt") => {
    setCollapsedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
    onStepActionClick?.(step);
  };

  const handleCreateModelOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    const context: ModelModalContext | null = "text-image";
    onModelPickerOpen("create-model", event.currentTarget, context);
    onStepActionClick?.("model");
  };

  const expandIfCollapsed = (step: "model" | "prompt") => {
    setCollapsedSteps((prev) => {
      if (!prev[step]) {
        return prev;
      }
      const next = { ...prev, [step]: false };
      onStepActionClick?.(step);
      return next;
    });
  };

  const selectorViewState = useMemo(
    () =>
      deriveCreateSelectorViewState({
        mode,
        modelId,
        isModelModalOpen,
        modelModalAnchor,
        isGenerateDisabled,
        hasSufficientCreditsForOutputGenerate,
        characterModeEnabled,
        selectedCharacterId,
        imageResolution,
      }),
    [
      characterModeEnabled,
      hasSufficientCreditsForOutputGenerate,
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
    disableOutputGenerate,
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
    agentChatOpen,
    onAgentInputChange,
    chatModeEnabled,
    onChatModeEnabledChange,
    directOpenAiBypassEnabled,
    onAgentSend,
    onAgentEnhanceSend,
    onAgentAttachmentDrop,
    onAgentAttachmentDragOver,
    onAgentAttachmentDragEnter,
    onAgentAttachmentDragLeave,
    onRemoveAgentAttachment,
    onClearAgentAttachments,
    onExpandChat,
    onClearAgentChat,
    onAssistantMessageEdit,
    onGenerateOutputPrompt: onGenerateFromAgentOutputPrompt,
    chatModeInlineGenerate: {
      onGenerate: onChatOffInlineGenerate,
      disabled: isChatOffInlineGenerateDisabled,
      ariaLabel: "Generate with current prompt",
    },
    onSavePrompt,
    isGenerating: isPromptGenerating,
    showGenerationThinkingInChat: false,
    shouldDisableSave,
    disableOutputGenerate,
    outputGenerateCostCredits,
    outputGenerateGuardrailReason: disableOutputGenerate ? guardrailReason : null,
    hideOutputGenerateControls: false,
    chatOnly: true,
    chatPromptSaveButtonClassName: "create-chat-pin-btn",
    chatPromptSaveButtonUnstyled: true,
  } satisfies Omit<
    React.ComponentProps<typeof PromptStep>,
    "stepNumber" | "isCollapsed" | "onToggleCollapse"
  >;

  const beginnerPromptStepProps: React.ComponentProps<typeof PromptStep> = {
    ...sharedPromptStepProps,
    stepNumber: promptStepNumber,
    title: "Build Your Prompt",
    subtitle: "Describe what you want to make. Enter to send, Shift+Enter for a new line.",
    beginnerSubtitle:
      "Send simple prompts to the agent to be refined into a high quality text prompt.",
    beginnerPinHelperText: "Click this button to pin your prompt to the reference grid.",
    isCollapsed: collapsedSteps.prompt,
    onToggleCollapse: () => toggleStep("prompt"),
    beginnerMode,
  };
  const expertPromptStepProps: React.ComponentProps<typeof PromptStep> = {
    ...sharedPromptStepProps,
    stepNumber: "1",
    title: "Ask anything",
    subtitle: "",
    beginnerPinHelperText: "",
    isCollapsed: false,
    onToggleCollapse: () => {
      // Expert mode keeps chat composer always open.
    },
    beginnerMode: false,
    className: `create-expert-prompt-step ${
      characterModeEnabled ? "is-character-mode-on" : "is-character-mode-off"
    }`,
    embedSendButtonInInput: true,
    hideAgentIntroMessage: true,
    agentAttachmentDropTarget: "input",
    hideInputDropHint: true,
    useAgentResponseInlineGeneratePrefab: true,
    highlightLatestAssistantOnly: true,
    CreateChatPanel: StandardCreateChatPanel,
    chatComposerOverlayEnabled: true,
    stackTrailingComposerControls: true,
    agentInputMaxHeightPx: EXPERT_CREATE_AGENT_INPUT_MAX_HEIGHT_PX,
    agentInputCollapseOnBlur: true,
    hideChatModeToggle: false,
    composerLeadingContent: (
      <StylesControl
        isOpen={isStylesPanelOpen}
        selectedStyleId={selectedStyleId}
        styles={stylesCatalog}
        onToggle={onStylesPanelToggle}
      />
    ),
  };

  return (
    <>
      {showExpertView ? (
        <StandardCreatePanelView
          promptStepProps={expertPromptStepProps}
          onGenerate={onGenerate}
          costCredits={costCredits}
          isPromptGenerating={isPromptGenerating}
          isGenerateDisabled={isGenerateDisabled}
          guardrailReason={guardrailReason}
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
          expertCreateMode={resolvedExpertCreateMode}
          onExpertCreateModeChange={handleExpertCreateModeChange}
        />
      ) : (
        <BeginnerCreatePanelView
          beginnerMode={beginnerMode}
          promptStepProps={beginnerPromptStepProps}
          characterStepSubtitle={characterStepSubtitle}
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
          collapsedModel={collapsedSteps.model}
          onToggleModel={() => toggleStep("model")}
          onExpandModel={() => expandIfCollapsed("model")}
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
        />
      )}
      <CharacterPickerModal
        isOpen={isCharacterPickerOpen}
        characterModeEnabled={characterModeEnabled}
        isCharacterOptionsLoading={isCharacterOptionsLoading}
        onClose={closeCharacterPicker}
        characterOptions={characterOptions}
        selectedCharacterId={selectedCharacterId}
        selectedCharacterLookId={selectedCharacterLookId}
        onSelectedCharacterIdChange={onSelectedCharacterIdChange}
        onOpenCharacterLibrary={onOpenCharacterLibrary}
        refreshCharacterOptions={refreshCharacterOptions}
        loadCharacterLookOptions={loadCharacterLookOptions}
        resolveCharacterAvatarUrlById={resolveCharacterAvatarUrlById}
      />
    </>
  );
}

export function ComposeSendCard({
  agentEnabled = false,
  agentError,
  onGenerate,
  costCredits,
  isPromptGenerating = false,
  isGenerateDisabled = false,
  guardrailReason,
  beginnerMode = false,
}: ComposeSendCardProps) {
  const costValue = costCredits != null ? costCredits : "—";
  const inlineGuardrailReason = guardrailReason;

  return (
    <div className="step-card prompt-step generate-step-card">
      <div className="step-card-header">
        {beginnerMode && <span className="step-badge">4</span>}
        <div className="step-header-copy">
          {beginnerMode ? <p className="step-title">Generate</p> : null}
          <span className="step-subtitle tiny helper-text">
            Run generation with the current prompt and selections.
          </span>
        </div>
      </div>
      <div className="create-controls single-control">
        <AgentGenerateButton
          onClick={onGenerate}
          disabled={isGenerateDisabled}
          isBusy={isPromptGenerating}
          cost={costValue}
        />
        {isGenerateDisabled && inlineGuardrailReason ? (
          <div className="inline-warning-hint">{inlineGuardrailReason}</div>
        ) : null}
        {agentEnabled && agentError ? <div className="inline-error-hint">{agentError}</div> : null}
      </div>
    </div>
  );
}
