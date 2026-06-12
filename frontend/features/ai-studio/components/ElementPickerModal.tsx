/**
 * Saved entity picker modal for Kling video workflows.
 * Lists persisted Character and Element library items and returns the chosen source.
 */
import React from "react";
import { Plus } from "phosphor-react";
import { listCharacterManagerCharacters } from "../../character-manager/logic/characterManagerPersistence";
import { fetchElementsManagerList } from "../../elements-manager/logic/elementsManagerPersistence";
import { buildElementProfileImageBackgroundStyle } from "../../elements-manager/logic/elementProfileImageTransform";
import {
  loadKlingCharacterLookOptions,
  toKlingPickerCharacterOption,
  toKlingPickerElementOption,
  type AiStudioKlingPickerOption,
} from "../logic/klingEntityAdapters";
import type { CharacterModeLookOption } from "../logic/characterModeLookSelection";
import {
  normalizeAiStudioKlingCharacterToken,
  type AiStudioKlingSavedEntitySourceKind,
} from "../logic/klingElements";
import {
  AiStudioPickerCard,
  AiStudioPickerFeedback,
  AiStudioPickerGrid,
  AiStudioPickerModalFrame,
  AiStudioPickerSection,
} from "./picker/AiStudioPickerPrimitives";
import { CharacterLookDropdown } from "./picker/CharacterLookDropdown";

type ElementPickerSelection = {
  sourceKind: AiStudioKlingSavedEntitySourceKind;
  sourceId: string;
  sourceCharacterLookId?: string | null;
};

export type ElementPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: ElementPickerSelection) => void;
  selectedSourceKind?: AiStudioKlingSavedEntitySourceKind | null;
  selectedSourceId?: string | null;
  selectedSourceCharacterLookId?: string | null;
  selectedEntities?: ElementPickerSelection[];
  onCreateCharacter?: () => void;
  onCreateElement?: () => void;
};

const getEntityInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "EL";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "EL";
};

const getPickerSelectionKey = ({
  sourceKind,
  sourceId,
  sourceCharacterLookId,
}: ElementPickerSelection): string | null => {
  const normalizedSourceId = sourceId.trim();
  if (!normalizedSourceId) return null;
  if (sourceKind === "character") {
    return `character:${normalizedSourceId}:${sourceCharacterLookId?.trim() ?? ""}`;
  }
  return `${sourceKind}:${normalizedSourceId}`;
};

export const ElementPickerModal = ({
  isOpen,
  onClose,
  onSelect,
  selectedSourceKind = null,
  selectedSourceId = null,
  selectedSourceCharacterLookId = null,
  selectedEntities = [],
  onCreateCharacter,
  onCreateElement,
}: ElementPickerModalProps) => {
  const [characters, setCharacters] = React.useState<AiStudioKlingPickerOption[]>([]);
  const [elements, setElements] = React.useState<AiStudioKlingPickerOption[]>([]);
  const [isCharactersLoading, setIsCharactersLoading] = React.useState(false);
  const [charactersError, setCharactersError] = React.useState<string | null>(null);
  const [hasLoadedCharacters, setHasLoadedCharacters] = React.useState(false);
  const [isElementsLoading, setIsElementsLoading] = React.useState(false);
  const [elementsError, setElementsError] = React.useState<string | null>(null);
  const [hasLoadedElements, setHasLoadedElements] = React.useState(false);
  const [lookOptionsByCharacterId, setLookOptionsByCharacterId] = React.useState<
    Record<string, CharacterModeLookOption[]>
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
  const refreshSequenceRef = React.useRef(0);

  const refreshNow = React.useCallback(async () => {
    const refreshSequence = refreshSequenceRef.current + 1;
    refreshSequenceRef.current = refreshSequence;
    setCharactersError(null);
    setElementsError(null);
    setIsCharactersLoading(true);
    setIsElementsLoading(true);

    void listCharacterManagerCharacters()
      .then((nextCharacters) => {
        if (refreshSequenceRef.current !== refreshSequence) return;
        setCharacters(nextCharacters.map(toKlingPickerCharacterOption));
      })
      .catch(() => {
        if (refreshSequenceRef.current !== refreshSequence) return;
        setCharactersError("Unable to load saved Characters.");
      })
      .finally(() => {
        if (refreshSequenceRef.current !== refreshSequence) return;
        setIsCharactersLoading(false);
        setHasLoadedCharacters(true);
      });

    void fetchElementsManagerList()
      .then((nextElements) => {
        if (refreshSequenceRef.current !== refreshSequence) return;
        setElements(
          nextElements
            .filter((item) => item.elementStatus === "ready")
            .map(toKlingPickerElementOption)
        );
      })
      .catch(() => {
        if (refreshSequenceRef.current !== refreshSequence) return;
        setElementsError("Unable to load saved Elements.");
      })
      .finally(() => {
        if (refreshSequenceRef.current !== refreshSequence) return;
        setIsElementsLoading(false);
        setHasLoadedElements(true);
      });
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    void refreshNow();
  }, [isOpen, refreshNow]);

  React.useEffect(() => {
    if (isOpen) return;
    refreshSequenceRef.current += 1;
  }, [isOpen]);

  const selectedEntityKeys = React.useMemo(
    () =>
      new Set(
        selectedEntities
          .map((entity) => getPickerSelectionKey(entity))
          .filter((value): value is string => Boolean(value))
      ),
    [selectedEntities]
  );

  const loadLooksForCharacter = React.useCallback(
    async (characterId: string) => {
      const normalizedCharacterId = characterId.trim();
      if (!normalizedCharacterId) return [];
      setLookLoadingByCharacterId((current) => ({
        ...current,
        [normalizedCharacterId]: true,
      }));
      setLookErrorByCharacterId((current) => ({
        ...current,
        [normalizedCharacterId]: null,
      }));
      try {
        const nextOptions = await loadKlingCharacterLookOptions(normalizedCharacterId);
        setLookOptionsByCharacterId((current) => ({
          ...current,
          [normalizedCharacterId]: nextOptions,
        }));
        setPendingLookIdByCharacterId((current) => {
          const currentPendingLookId = current[normalizedCharacterId]?.trim() ?? "";
          const selectedLookId =
            normalizedCharacterId === selectedSourceId
              ? (selectedSourceCharacterLookId?.trim() ?? "")
              : "";
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
    [selectedSourceCharacterLookId, selectedSourceId]
  );

  React.useEffect(() => {
    if (!isOpen) return;
    characters.forEach((option) => {
      if (lookOptionsByCharacterId[option.sourceId] || lookLoadingByCharacterId[option.sourceId]) {
        return;
      }
      void loadLooksForCharacter(option.sourceId);
    });
  }, [
    characters,
    isOpen,
    loadLooksForCharacter,
    lookLoadingByCharacterId,
    lookOptionsByCharacterId,
  ]);

  const renderSectionBody = React.useCallback(
    ({
      sectionLabel,
      options,
      isLoading,
      errorMessage,
      hasLoaded,
    }: {
      sectionLabel: "Characters" | "Elements";
      options: AiStudioKlingPickerOption[];
      isLoading: boolean;
      errorMessage: string | null;
      hasLoaded: boolean;
    }) => {
      if (options.length > 0) {
        return (
          <AiStudioPickerGrid ariaLabel={`${sectionLabel} options`}>
            {options.map((option) => {
              const lookOptions =
                option.sourceKind === "character"
                  ? (lookOptionsByCharacterId[option.sourceId] ?? [])
                  : [];
              const isLookLoading =
                option.sourceKind === "character" &&
                Boolean(lookLoadingByCharacterId[option.sourceId]);
              const lookError =
                option.sourceKind === "character"
                  ? (lookErrorByCharacterId[option.sourceId] ?? null)
                  : null;
              const fallbackLookId =
                lookOptions.find((item) => item.isDefault)?.id ?? lookOptions[0]?.id ?? "";
              const selectedLookIdForCard =
                option.sourceKind === "character"
                  ? (pendingLookIdByCharacterId[option.sourceId] ??
                    (option.sourceId === selectedSourceId
                      ? (selectedSourceCharacterLookId?.trim() ?? "")
                      : "") ??
                    fallbackLookId)
                  : "";
              const optionSelectionKey = getPickerSelectionKey({
                sourceKind: option.sourceKind,
                sourceId: option.sourceId,
                sourceCharacterLookId:
                  option.sourceKind === "character"
                    ? selectedLookIdForCard || fallbackLookId
                    : null,
              });
              const isChosen = optionSelectionKey
                ? selectedEntityKeys.has(optionSelectionKey)
                : false;
              const isActive =
                isChosen ||
                (option.sourceKind === selectedSourceKind &&
                  option.sourceId === selectedSourceId &&
                  (option.sourceKind !== "character" ||
                    (selectedLookIdForCard || fallbackLookId) ===
                      (selectedSourceCharacterLookId?.trim() ?? "")));
              const token =
                option.sourceKind === "character"
                  ? normalizeAiStudioKlingCharacterToken(option.name)
                  : option.token;
              return (
                <AiStudioPickerCard
                  key={`${option.sourceKind}-${option.sourceId}`}
                  isActive={isActive}
                  className={
                    option.sourceKind === "element"
                      ? "ai-character-picker-card--element"
                      : "ai-character-picker-card--with-looks"
                  }
                  onSelect={() => {
                    onSelect({
                      sourceKind: option.sourceKind,
                      sourceId: option.sourceId,
                      sourceCharacterLookId:
                        option.sourceKind === "character"
                          ? selectedLookIdForCard || fallbackLookId || null
                          : null,
                    });
                    onClose();
                  }}
                  avatar={
                    option.profileImageUrl ? (
                      <div
                        className="ai-character-list-avatar-image"
                        style={buildElementProfileImageBackgroundStyle(
                          option.profileImageUrl,
                          option.profileImageTransform ?? null,
                          44
                        )}
                        aria-hidden="true"
                      />
                    ) : (
                      <span className="ai-character-list-avatar-initials">
                        {getEntityInitials(option.name)}
                      </span>
                    )
                  }
                  label={
                    isActive
                      ? "Selected"
                      : option.sourceKind === "character"
                        ? "Character"
                        : "Element"
                  }
                  name={option.name}
                  token={
                    token ? (
                      <p
                        className={`tiny ai-character-list-token ai-character-list-token--${option.sourceKind}`}
                      >
                        @{token}
                      </p>
                    ) : null
                  }
                  footer={
                    option.sourceKind !== "character" ? null : isLookLoading ? (
                      <p className="ai-character-look-meta tiny subdued">Loading looks...</p>
                    ) : lookError ? (
                      <p className="ai-character-look-meta tiny">{lookError}</p>
                    ) : lookOptions.length > 1 ? (
                      <div className="ai-character-look-field">
                        <span className="ai-character-look-label">Select look</span>
                        <CharacterLookDropdown
                          characterName={option.name}
                          value={selectedLookIdForCard || fallbackLookId}
                          options={lookOptions}
                          onChange={(nextLookId) => {
                            setPendingLookIdByCharacterId((current) => ({
                              ...current,
                              [option.sourceId]: nextLookId,
                            }));
                            onSelect({
                              sourceKind: option.sourceKind,
                              sourceId: option.sourceId,
                              sourceCharacterLookId: nextLookId,
                            });
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
        );
      }

      if (isLoading) {
        return (
          <AiStudioPickerFeedback
            isLoading
            loadingMessage={`Loading saved ${sectionLabel}...`}
            errorMessage={null}
            emptyMessage=""
          />
        );
      }

      if (errorMessage) {
        return (
          <AiStudioPickerFeedback
            isLoading={false}
            loadingMessage=""
            errorMessage={errorMessage}
            emptyMessage=""
            onRetry={() => void refreshNow()}
          />
        );
      }

      if (hasLoaded) {
        return (
          <AiStudioPickerFeedback
            isLoading={false}
            loadingMessage=""
            errorMessage={null}
            emptyMessage={`No saved ${sectionLabel} available.`}
          />
        );
      }

      return null;
    },
    [
      lookErrorByCharacterId,
      lookLoadingByCharacterId,
      lookOptionsByCharacterId,
      onClose,
      onSelect,
      pendingLookIdByCharacterId,
      refreshNow,
      selectedEntityKeys,
      selectedSourceCharacterLookId,
      selectedSourceId,
      selectedSourceKind,
    ]
  );

  return (
    <AiStudioPickerModalFrame
      isOpen={isOpen}
      activityId="video-element-picker-modal"
      ariaLabel="Choose Characters/Elements"
      title="Choose Characters/Elements"
      subtitle="Select a saved Character or Element for the linked video asset slots."
      onClose={onClose}
    >
      <div className="ai-character-picker-sections">
        {(
          [
            {
              sectionLabel: "Characters",
              options: characters,
              isLoading: isCharactersLoading,
              errorMessage: charactersError,
              hasLoaded: hasLoadedCharacters,
              titleClassName:
                "kling-entity-picker-section-title kling-entity-picker-section-title--characters",
              supportsCreateAction: true,
              createActionClassName:
                "ai-library-create-btn ai-library-create-btn--inline kling-entity-picker-create-btn kling-entity-picker-create-btn--characters",
              createActionLabel: "Create New Character",
              onCreateAction: onCreateCharacter,
            },
            {
              sectionLabel: "Elements",
              options: elements,
              isLoading: isElementsLoading,
              errorMessage: elementsError,
              hasLoaded: hasLoadedElements,
              titleClassName:
                "kling-entity-picker-section-title kling-entity-picker-section-title--elements",
              supportsCreateAction: true,
              createActionClassName:
                "ai-library-create-btn ai-library-create-btn--inline kling-entity-picker-create-btn kling-entity-picker-create-btn--elements",
              createActionLabel: "Create New Element",
              onCreateAction: onCreateElement,
            },
          ] as const
        ).map(
          ({
            sectionLabel,
            options,
            isLoading,
            errorMessage,
            hasLoaded,
            titleClassName,
            supportsCreateAction,
            createActionClassName,
            createActionLabel,
            onCreateAction,
          }) =>
            options.length > 0 || (supportsCreateAction && onCreateAction) ? (
              <AiStudioPickerSection
                key={sectionLabel}
                title={<div className={titleClassName}>{sectionLabel}</div>}
                headerAction={
                  supportsCreateAction && onCreateAction ? (
                    <button
                      type="button"
                      className={createActionClassName}
                      onClick={() => {
                        onClose();
                        onCreateAction();
                      }}
                    >
                      <Plus
                        size={14}
                        weight="bold"
                        className="ai-library-create-btn-icon"
                        aria-hidden
                      />
                      <span>{createActionLabel}</span>
                    </button>
                  ) : null
                }
              >
                {renderSectionBody({
                  sectionLabel,
                  options,
                  isLoading,
                  errorMessage,
                  hasLoaded,
                })}
              </AiStudioPickerSection>
            ) : null
        )}
      </div>
    </AiStudioPickerModalFrame>
  );
};
