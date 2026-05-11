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
  type AiStudioKlingEntitySourceKind,
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
  onSelect: (selection: { sourceKind: AiStudioKlingEntitySourceKind; sourceId: string }) => void;
  selectedSourceKind?: AiStudioKlingEntitySourceKind | null;
  selectedSourceId?: string | null;
  selectedEntities?: Array<{
    sourceKind: AiStudioKlingEntitySourceKind;
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
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refreshNow = React.useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const [nextCharacters, nextElements] = await Promise.all([
        listCharacterManagerCharacters(),
        fetchElementsManagerList(),
      ]);
      setCharacters(nextCharacters.map(toKlingPickerCharacterOption));
      setElements(
        nextElements
          .filter((item) => item.elementStatus === "ready")
          .map(toKlingPickerElementOption)
      );
    } catch {
      setError("Unable to load saved Characters and Elements.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    void refreshNow();
  }, [isOpen, refreshNow]);

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

  return (
    <AiStudioPickerModalFrame
      isOpen={isOpen}
      activityId="video-element-picker-modal"
      ariaLabel="Choose Characters/Elements"
      title="Choose Characters/Elements"
      subtitle="Select a saved Character or Element for the Kling 3.0 element slots."
      onClose={onClose}
    >
      {characters.length > 0 || elements.length > 0 ? (
        <div className="ai-character-picker-sections">
          {(
            [
              {
                sectionLabel: "Characters",
                options: characters,
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
                  {options.length > 0 ? (
                    <AiStudioPickerGrid ariaLabel={`${sectionLabel} options`}>
                      {options.map((option) => {
                        const optionSelectionKey = `${option.sourceKind}:${option.sourceId}`;
                        const isChosen = selectedEntityKeys.has(optionSelectionKey);
                        const isActive =
                          isChosen ||
                          (option.sourceKind === selectedSourceKind &&
                            option.sourceId === selectedSourceId);
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
                  ) : null}
                </AiStudioPickerSection>
              ) : null
          )}
        </div>
      ) : (
        <AiStudioPickerFeedback
          isLoading={isLoading}
          loadingMessage="Loading saved Characters and Elements..."
          errorMessage={error}
          emptyMessage="No saved Characters or Elements available."
          onRetry={() => void refreshNow()}
        />
      )}
    </AiStudioPickerModalFrame>
  );
};
