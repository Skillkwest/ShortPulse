/**
 * Primary Styles library panel for AI Studio.
 * Renders style tiles and owns edit/delete confirmation modals for style customization.
 */
import React from "react";
import { X } from "phosphor-react";
import type { StylesLibraryStyleDetails } from "../types";
import type { ExpertEditStyleTile } from "./edit/expertEditStyles";
import { resolveStylePreviewBackgroundImage } from "./edit/expertEditStyles";

export type StylesLibraryPanelProps = {
  styles: readonly ExpertEditStyleTile[];
  selectedStyleId: string | null;
  onSelectStyle?: (styleId: string | null) => void;
  onDeleteStyle?: (styleId: string) => Promise<boolean> | boolean;
  deleteError?: string | null;
  onSaveStyleDetails?: (
    styleId: string,
    details: StylesLibraryStyleDetails
  ) => Promise<boolean> | boolean;
  saveError?: string | null;
};

type PendingStyleEditState = {
  styleId: string;
  styleTitle: string;
  details: StylesLibraryStyleDetails;
};

const reorderById = (ids: readonly string[], sourceId: string, targetId: string): string[] => {
  if (sourceId === targetId) return [...ids];
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) return [...ids];
  const next = [...ids];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
};

const buildInitialStyleDetails = (style: ExpertEditStyleTile): StylesLibraryStyleDetails => {
  const resolvedTitle = style.title.trim();
  const resolvedStyle = style.style?.trim() || resolvedTitle;
  const resolvedReferenceImageName = style.referenceImageName?.trim() || resolvedTitle;
  return {
    style: resolvedStyle,
    title: resolvedTitle,
    referenceImageName: resolvedReferenceImageName,
    stylePrompt: style.stylePrompt?.trim() ?? "",
  };
};

const normalizeStyleDetailsDraft = (
  value: StylesLibraryStyleDetails
): StylesLibraryStyleDetails => {
  return {
    style: value.style.trim(),
    title: value.title.trim(),
    referenceImageName: value.referenceImageName.trim(),
    stylePrompt: value.stylePrompt.trim(),
  };
};

export function StylesLibraryPanel({
  styles,
  selectedStyleId,
  onSelectStyle,
  onDeleteStyle,
  deleteError = null,
  onSaveStyleDetails,
  saveError = null,
}: StylesLibraryPanelProps) {
  const [generatedPlaceholderStyles, setGeneratedPlaceholderStyles] = React.useState<
    ExpertEditStyleTile[]
  >([]);
  const [orderedStyleIds, setOrderedStyleIds] = React.useState<string[]>([]);
  const [draggedStyleId, setDraggedStyleId] = React.useState<string | null>(null);
  const [dropTargetStyleId, setDropTargetStyleId] = React.useState<string | null>(null);
  const [pendingDeleteStyle, setPendingDeleteStyle] = React.useState<ExpertEditStyleTile | null>(
    null
  );
  const [pendingStyleEdit, setPendingStyleEdit] = React.useState<PendingStyleEditState | null>(
    null
  );
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false);
  const [editSubmitting, setEditSubmitting] = React.useState(false);
  const [localDeleteError, setLocalDeleteError] = React.useState<string | null>(null);
  const [localSaveError, setLocalSaveError] = React.useState<string | null>(null);
  const basePlaceholderCount = React.useMemo(
    () => styles.filter((style) => style.placeholder).length,
    [styles]
  );
  const allStyles = React.useMemo(
    () => [...styles, ...generatedPlaceholderStyles],
    [generatedPlaceholderStyles, styles]
  );
  const renderedStyles = React.useMemo(() => {
    if (allStyles.length === 0) return allStyles;
    if (orderedStyleIds.length === 0) return allStyles;
    const byId = new Map(allStyles.map((style) => [style.id, style] as const));
    const ordered = orderedStyleIds
      .map((styleId) => byId.get(styleId))
      .filter((style): style is ExpertEditStyleTile => Boolean(style));
    return ordered.length === allStyles.length ? ordered : allStyles;
  }, [allStyles, orderedStyleIds]);

  const closeDeleteModal = React.useCallback(() => {
    if (deleteSubmitting) return;
    setPendingDeleteStyle(null);
    setLocalDeleteError(null);
  }, [deleteSubmitting]);

  const closeEditModal = React.useCallback(() => {
    if (editSubmitting) return;
    setPendingStyleEdit(null);
    setLocalSaveError(null);
  }, [editSubmitting]);

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!pendingDeleteStyle?.id || !onDeleteStyle || deleteSubmitting) return;
    setDeleteSubmitting(true);
    setLocalDeleteError(null);
    try {
      const deleted = await onDeleteStyle(pendingDeleteStyle.id);
      if (deleted) {
        setPendingDeleteStyle(null);
      } else {
        setLocalDeleteError("Unable to delete this style right now.");
      }
    } catch {
      setLocalDeleteError("Unable to delete this style right now.");
    } finally {
      setDeleteSubmitting(false);
    }
  }, [deleteSubmitting, onDeleteStyle, pendingDeleteStyle]);

  const handleSaveStyleDetails = React.useCallback(async () => {
    if (!pendingStyleEdit || editSubmitting) return;
    const normalizedDetails = normalizeStyleDetailsDraft(pendingStyleEdit.details);
    if (
      !normalizedDetails.style ||
      !normalizedDetails.title ||
      !normalizedDetails.referenceImageName
    ) {
      setLocalSaveError("Style, Title, and Reference Image Name are required.");
      return;
    }

    setEditSubmitting(true);
    setLocalSaveError(null);
    try {
      if (!onSaveStyleDetails) {
        setPendingStyleEdit(null);
        return;
      }
      const saved = await onSaveStyleDetails(pendingStyleEdit.styleId, normalizedDetails);
      if (saved) {
        setPendingStyleEdit(null);
      } else {
        setLocalSaveError("Unable to save this style right now.");
      }
    } catch {
      setLocalSaveError("Unable to save this style right now.");
    } finally {
      setEditSubmitting(false);
    }
  }, [editSubmitting, onSaveStyleDetails, pendingStyleEdit]);

  const openStyleEditModal = React.useCallback((style: ExpertEditStyleTile) => {
    setLocalSaveError(null);
    setPendingStyleEdit({
      styleId: style.id,
      styleTitle: style.title,
      details: buildInitialStyleDetails(style),
    });
  }, []);
  const handleAddPlaceholderStyle = React.useCallback(() => {
    setGeneratedPlaceholderStyles((previous) => {
      const nextPlaceholderIndex = basePlaceholderCount + previous.length + 1;
      return [
        ...previous,
        {
          id: `style-library-placeholder-${nextPlaceholderIndex}-${Date.now()}`,
          title: `Placeholder ${nextPlaceholderIndex}`,
          previewUrl: null,
          placeholder: true,
        },
      ];
    });
  }, [basePlaceholderCount]);
  const handleStyleDragStart = React.useCallback(
    (styleId: string, event: React.DragEvent<HTMLElement>) => {
      setDraggedStyleId(styleId);
      setDropTargetStyleId(null);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/style-library-id", styleId);
    },
    []
  );
  const handleStyleDragOver = React.useCallback(
    (styleId: string, event: React.DragEvent<HTMLElement>) => {
      if (!draggedStyleId || draggedStyleId === styleId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (dropTargetStyleId !== styleId) {
        setDropTargetStyleId(styleId);
      }
    },
    [draggedStyleId, dropTargetStyleId]
  );
  const handleStyleDrop = React.useCallback(
    (targetStyleId: string, event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      const sourceStyleId =
        draggedStyleId || event.dataTransfer.getData("text/style-library-id") || null;
      if (!sourceStyleId || sourceStyleId === targetStyleId) {
        setDropTargetStyleId(null);
        return;
      }
      setOrderedStyleIds((previous) => reorderById(previous, sourceStyleId, targetStyleId));
      setDropTargetStyleId(null);
    },
    [draggedStyleId]
  );
  const handleStyleDragEnd = React.useCallback(() => {
    setDraggedStyleId(null);
    setDropTargetStyleId(null);
  }, []);

  React.useEffect(() => {
    const hasModalOpen = Boolean(pendingDeleteStyle || pendingStyleEdit);
    if (!hasModalOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (pendingStyleEdit) {
        closeEditModal();
        return;
      }
      closeDeleteModal();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeDeleteModal, closeEditModal, pendingDeleteStyle, pendingStyleEdit]);
  React.useEffect(() => {
    const styleIds = allStyles.map((style) => style.id);
    if (styleIds.length === 0) {
      setOrderedStyleIds([]);
      return;
    }
    setOrderedStyleIds((previous) => {
      const previousSet = new Set(previous);
      const retained = previous.filter((styleId) => styleIds.includes(styleId));
      const appended = styleIds.filter((styleId) => !previousSet.has(styleId));
      const next = [...retained, ...appended];
      if (
        next.length === previous.length &&
        next.every((value, index) => previous[index] === value)
      ) {
        return previous;
      }
      return next;
    });
  }, [allStyles]);

  return (
    <section className="styles-library-panel" aria-label="Styles library">
      <header className="styles-library-header">
        <p className="eyebrow">Styles Library</p>
        <p className="tiny subdued helper-text">
          Browse all loaded styles. Customization tools are coming in a later phase.
        </p>
      </header>
      <div className="styles-library-scroll">
        <div className="styles-library-grid" role="list" aria-label="Styles library tiles">
          {renderedStyles.map((style) => {
            const isSelected = !style.placeholder && selectedStyleId === style.id;
            return (
              <article
                key={style.id}
                role="listitem"
                className={`styles-library-tile ${isSelected ? "is-selected" : ""} ${
                  draggedStyleId === style.id ? "is-dragging" : ""
                } ${dropTargetStyleId === style.id ? "is-drop-target" : ""} ${
                  style.placeholder ? "is-placeholder" : ""
                }`.trim()}
                draggable
                onDragStart={(event) => handleStyleDragStart(style.id, event)}
                onDragOver={(event) => handleStyleDragOver(style.id, event)}
                onDrop={(event) => handleStyleDrop(style.id, event)}
                onDragEnd={handleStyleDragEnd}
              >
                {!style.placeholder ? (
                  <button
                    type="button"
                    className="styles-library-tile-delete"
                    aria-label={`Delete style: ${style.title}`}
                    onClick={() => {
                      setLocalDeleteError(null);
                      setPendingDeleteStyle(style);
                    }}
                  >
                    <X size={12} weight="bold" />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="styles-library-tile-select"
                  aria-label={`Style tile: ${style.title}${style.placeholder ? " (coming soon)" : ""}`}
                  aria-pressed={style.placeholder ? undefined : isSelected}
                  disabled={style.placeholder}
                  onClick={() => {
                    if (style.placeholder) return;
                    onSelectStyle?.(style.id);
                    openStyleEditModal(style);
                  }}
                >
                  <span className="styles-library-tile-title">{style.title}</span>
                  <span
                    className="styles-library-tile-preview"
                    style={
                      style.previewUrl
                        ? {
                            backgroundImage: resolveStylePreviewBackgroundImage(style.previewUrl),
                          }
                        : undefined
                    }
                    aria-hidden="true"
                  >
                    {style.placeholder ? (
                      <span className="styles-library-tile-coming-soon">Coming soon</span>
                    ) : null}
                  </span>
                </button>
              </article>
            );
          })}
          <article role="listitem" className="styles-library-add-tile">
            <button
              type="button"
              className="styles-library-add-button"
              aria-label="Add placeholder style"
              onClick={handleAddPlaceholderStyle}
            >
              <span className="styles-library-add-plus" aria-hidden="true">
                +
              </span>
              <span className="styles-library-add-label tiny">Add style</span>
            </button>
          </article>
        </div>
      </div>
      {pendingStyleEdit ? (
        <div
          className="styles-library-edit-modal-backdrop"
          role="presentation"
          onClick={closeEditModal}
        >
          <div
            className="styles-library-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="styles-edit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="styles-edit-title" className="styles-library-edit-title">
              Edit style
            </p>
            <p className="styles-library-edit-copy tiny subdued">
              Update <strong>{pendingStyleEdit.styleTitle}</strong> details.
            </p>
            <label className="styles-library-edit-field">
              <span className="styles-library-edit-label">Style</span>
              <input
                type="text"
                className="styles-library-edit-input"
                value={pendingStyleEdit.details.style}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setPendingStyleEdit((previous) => {
                    if (!previous) return previous;
                    return {
                      ...previous,
                      details: {
                        ...previous.details,
                        style: nextValue,
                      },
                    };
                  });
                }}
              />
            </label>
            <label className="styles-library-edit-field">
              <span className="styles-library-edit-label">Title</span>
              <input
                type="text"
                className="styles-library-edit-input"
                value={pendingStyleEdit.details.title}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setPendingStyleEdit((previous) => {
                    if (!previous) return previous;
                    return {
                      ...previous,
                      details: {
                        ...previous.details,
                        title: nextValue,
                      },
                    };
                  });
                }}
              />
            </label>
            <label className="styles-library-edit-field">
              <span className="styles-library-edit-label">Reference Image Name</span>
              <input
                type="text"
                className="styles-library-edit-input"
                value={pendingStyleEdit.details.referenceImageName}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setPendingStyleEdit((previous) => {
                    if (!previous) return previous;
                    return {
                      ...previous,
                      details: {
                        ...previous.details,
                        referenceImageName: nextValue,
                      },
                    };
                  });
                }}
              />
            </label>
            <label className="styles-library-edit-field">
              <span className="styles-library-edit-label">Style Prompt</span>
              <textarea
                className="styles-library-edit-textarea"
                rows={5}
                value={pendingStyleEdit.details.stylePrompt}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setPendingStyleEdit((previous) => {
                    if (!previous) return previous;
                    return {
                      ...previous,
                      details: {
                        ...previous.details,
                        stylePrompt: nextValue,
                      },
                    };
                  });
                }}
              />
            </label>
            {saveError ? <p className="styles-library-edit-error tiny">{saveError}</p> : null}
            {localSaveError ? (
              <p className="styles-library-edit-error tiny">{localSaveError}</p>
            ) : null}
            <div className="styles-library-edit-actions">
              <button type="button" className="ghost-btn mini" onClick={closeEditModal}>
                Cancel
              </button>
              <button
                type="button"
                className="ghost-btn mini styles-library-edit-save"
                disabled={editSubmitting}
                onClick={() => {
                  void handleSaveStyleDetails();
                }}
              >
                {editSubmitting ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingDeleteStyle ? (
        <div
          className="styles-library-delete-modal-backdrop"
          role="presentation"
          onClick={closeDeleteModal}
        >
          <div
            className="styles-library-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="styles-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="styles-delete-title" className="styles-library-delete-title">
              Delete style?
            </p>
            <p className="styles-library-delete-copy tiny subdued">
              Remove <strong>{pendingDeleteStyle.title}</strong> from your style library
              permanently?
            </p>
            {deleteError ? <p className="styles-library-delete-error tiny">{deleteError}</p> : null}
            {localDeleteError ? (
              <p className="styles-library-delete-error tiny">{localDeleteError}</p>
            ) : null}
            <div className="styles-library-delete-actions">
              <button type="button" className="ghost-btn mini" onClick={closeDeleteModal}>
                No
              </button>
              <button
                type="button"
                className="ghost-btn mini styles-library-delete-confirm"
                disabled={deleteSubmitting}
                onClick={() => {
                  void handleDeleteConfirm();
                }}
              >
                {deleteSubmitting ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
