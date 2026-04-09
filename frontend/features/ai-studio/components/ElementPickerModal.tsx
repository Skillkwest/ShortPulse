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
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";

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

  useAiStudioModalActivity("video-element-picker-modal", isOpen);

  if (!isOpen) return null;

  return (
    <AiStudioModalLayer>
      <>
        <div className="model-modal-backdrop ai-character-picker-backdrop" onClick={onClose} />
        <div
          className="model-modal ai-character-picker-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Choose Characters/Elements"
        >
          <div className="model-modal-header">
            <div className="model-modal-title-group">
              <h3 className="model-modal-title">Choose Characters/Elements</h3>
              <p className="model-modal-subtitle">
                Select a saved Character or Element for the Kling 3.0 element slots.
              </p>
            </div>
            <button
              type="button"
              className="ghost-btn mini model-modal-close"
              aria-label="Close Characters/Elements picker"
              onClick={onClose}
            >
              ×
            </button>
          </div>
          <div className="model-modal-scroll">
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
                        "character-mode-create-btn character-mode-create-btn--inline kling-entity-picker-create-btn kling-entity-picker-create-btn--characters",
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
                        "character-mode-create-btn character-mode-create-btn--inline kling-entity-picker-create-btn kling-entity-picker-create-btn--elements",
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
                      <section key={sectionLabel} className="ai-character-picker-section">
                        <div className="kling-entity-picker-section-header">
                          <div className={titleClassName}>{sectionLabel}</div>
                          {supportsCreateAction && onCreateAction ? (
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
                                className="character-mode-create-btn-icon"
                                aria-hidden
                              />
                              <span>{createActionLabel}</span>
                            </button>
                          ) : null}
                        </div>
                        {options.length > 0 ? (
                          <div
                            className="ai-character-picker-grid"
                            role="list"
                            aria-label={`${sectionLabel} options`}
                          >
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
                                  : option.alias;
                              return (
                                <article
                                  key={`${option.sourceKind}-${option.sourceId}`}
                                  role="listitem"
                                  className={`ai-character-list-card ai-character-picker-card ${
                                    option.sourceKind === "element"
                                      ? "ai-character-picker-card--element"
                                      : "ai-character-picker-card--character"
                                  } ${isActive ? "is-active" : ""}`}
                                >
                                  <button
                                    type="button"
                                    className="ai-character-list-select-btn"
                                    aria-pressed={isActive}
                                    onClick={() => {
                                      onSelect({
                                        sourceKind: option.sourceKind,
                                        sourceId: option.sourceId,
                                      });
                                      onClose();
                                    }}
                                  >
                                    <div className="ai-character-list-main">
                                      <span className="ai-character-list-avatar" aria-hidden="true">
                                        {option.profileImageUrl ? (
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
                                        )}
                                      </span>
                                      <div className="ai-character-list-copy">
                                        <p className="metric-label tiny">
                                          {isActive
                                            ? "Selected"
                                            : option.sourceKind === "character"
                                              ? "Character"
                                              : "Element"}
                                        </p>
                                        <p className="ai-character-list-name">{option.name}</p>
                                        {token ? <p className="tiny subdued">@{token}</p> : null}
                                      </div>
                                    </div>
                                  </button>
                                </article>
                              );
                            })}
                          </div>
                        ) : null}
                      </section>
                    ) : null
                )}
              </div>
            ) : isLoading ? (
              <p className="tiny subdued ai-character-picker-empty">
                Loading saved Characters and Elements...
              </p>
            ) : error ? (
              <div className="ai-character-picker-empty">
                <p className="tiny">{error}</p>
                <button type="button" className="ghost-btn mini" onClick={() => void refreshNow()}>
                  Retry
                </button>
              </div>
            ) : (
              <p className="tiny subdued ai-character-picker-empty">
                No saved Characters or Elements available.
              </p>
            )}
          </div>
        </div>
      </>
    </AiStudioModalLayer>
  );
};
