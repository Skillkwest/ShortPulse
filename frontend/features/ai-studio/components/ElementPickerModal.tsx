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
  toKlingPickerCharacterOption,
  toKlingPickerElementOption,
  type AiStudioKlingPickerOption,
} from "../logic/klingEntityAdapters";
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

export type ElementPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: {
    sourceKind: AiStudioKlingSavedEntitySourceKind;
    sourceId: string;
  }) => void;
  selectedSourceKind?: AiStudioKlingSavedEntitySourceKind | null;
  selectedSourceId?: string | null;
  selectedEntities?: Array<{
    sourceKind: AiStudioKlingSavedEntitySourceKind;
    sourceId: string;
  }>;
  onCreateCharacter?: () => void;
  onCreateElement?: () => void;
};

const getEntityInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "EL";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "EL";
};

export const ElementPickerModal = ({
  isOpen,
  onClose,
  onSelect,
  selectedSourceKind = null,
  selectedSourceId = null,
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
          .map((entity) => {
            const sourceId = entity.sourceId.trim();
            return sourceId ? `${entity.sourceKind}:${sourceId}` : null;
          })
          .filter((value): value is string => Boolean(value))
      ),
    [selectedEntities]
  );

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
              const optionSelectionKey = `${option.sourceKind}:${option.sourceId}`;
              const isChosen = selectedEntityKeys.has(optionSelectionKey);
              const isActive =
                isChosen ||
                (option.sourceKind === selectedSourceKind && option.sourceId === selectedSourceId);
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
                      : "ai-character-picker-card--character"
                  }
                  onSelect={() => {
                    onSelect({
                      sourceKind: option.sourceKind,
                      sourceId: option.sourceId,
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
    [onClose, onSelect, refreshNow, selectedEntityKeys, selectedSourceId, selectedSourceKind]
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
