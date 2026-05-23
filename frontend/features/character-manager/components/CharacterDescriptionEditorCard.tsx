/**
 * Character description editor card.
 * Renders the look-scoped description input, helper tip, and character counter.
 */
import React from "react";

const CHARACTER_DESCRIPTION_INPUT_BACKGROUND = "#191a1f";
const CHARACTER_REFERENCE_DROP_ZONE_HEIGHT = "142.5px";

const CHARACTER_DESCRIPTION_TEXT_CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  padding: "14px 16px 30px",
  position: "relative",
  border: "1px solid rgba(34, 40, 49, 0.96)",
  borderRadius: "12px",
  background: CHARACTER_DESCRIPTION_INPUT_BACKGROUND,
  backgroundColor: CHARACTER_DESCRIPTION_INPUT_BACKGROUND,
  height: CHARACTER_REFERENCE_DROP_ZONE_HEIGHT,
  minHeight: CHARACTER_REFERENCE_DROP_ZONE_HEIGHT,
  maxHeight: CHARACTER_REFERENCE_DROP_ZONE_HEIGHT,
  boxSizing: "border-box",
};

const CHARACTER_DESCRIPTION_INPUT_STYLE: React.CSSProperties = {
  flex: "1 1 auto",
  height: "100%",
  padding: "6px 4px",
  width: "100%",
  minHeight: 0,
  border: "none",
  outline: "none",
  resize: "none",
  background: CHARACTER_DESCRIPTION_INPUT_BACKGROUND,
  backgroundColor: CHARACTER_DESCRIPTION_INPUT_BACKGROUND,
  color: "rgba(232, 236, 244, 0.96)",
  fontSize: "0.92rem",
  lineHeight: 1.45,
  boxSizing: "border-box",
};

const CHARACTER_DESCRIPTION_CARD_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "8px",
  minWidth: 0,
};

const CHARACTER_DESCRIPTION_LABEL_ROW_STYLE: React.CSSProperties = {
  marginBottom: "2px",
};

const CHARACTER_DESCRIPTION_COUNT_STYLE: React.CSSProperties = {
  position: "absolute",
  right: "12px",
  bottom: "10px",
  margin: 0,
  color: "rgba(183, 190, 204, 0.78)",
  fontSize: "0.8rem",
};

const CHARACTER_DESCRIPTION_HELPER_ROW_STYLE: React.CSSProperties = {
  minHeight: "14px",
};

type CharacterDescriptionEditorCardProps = {
  description: string;
  helperText?: string;
  maxLength: number;
  rows: number;
  disabled: boolean;
  cardGapPx?: number;
  containerHeightPx?: number;
  containerPaddingTopPx?: number;
  containerPaddingXpx?: number;
  containerPaddingBottomPx?: number;
  textareaPaddingYpx?: number;
  footerMinHeightPx?: number;
  onChangeDescription: (value: string) => void;
};

/**
 * Renders the character description editor with unchanged helper/counter behavior.
 */
export function CharacterDescriptionEditorCard({
  description,
  helperText,
  maxLength,
  rows,
  disabled,
  cardGapPx,
  containerHeightPx,
  containerPaddingTopPx,
  containerPaddingXpx,
  containerPaddingBottomPx,
  textareaPaddingYpx,
  footerMinHeightPx,
  onChangeDescription,
}: CharacterDescriptionEditorCardProps) {
  const resolvedContainerHeightPx =
    containerHeightPx ?? Number.parseFloat(CHARACTER_REFERENCE_DROP_ZONE_HEIGHT);
  const resolvedContainerPaddingTopPx = containerPaddingTopPx ?? 14;
  const resolvedContainerPaddingXpx = containerPaddingXpx ?? 16;
  const resolvedContainerPaddingBottomPx = containerPaddingBottomPx ?? 30;
  const resolvedTextareaPaddingYpx = textareaPaddingYpx ?? 6;
  const resolvedFooterMinHeightPx = footerMinHeightPx ?? 14;

  return (
    <div
      className="character-sheet-description-card character-profile-fields character-profile-fields--label-serif"
      style={{
        ...CHARACTER_DESCRIPTION_CARD_STYLE,
        gap: `${cardGapPx ?? 8}px`,
      }}
    >
      <div
        className="character-description-label-row"
        style={CHARACTER_DESCRIPTION_LABEL_ROW_STYLE}
      >
        <label className="input-label" htmlFor="character-manager-description">
          Description:
        </label>
      </div>
      <div
        className="character-description-text-container"
        style={{
          ...CHARACTER_DESCRIPTION_TEXT_CONTAINER_STYLE,
          padding: `${resolvedContainerPaddingTopPx}px ${resolvedContainerPaddingXpx}px ${resolvedContainerPaddingBottomPx}px`,
          height: `${resolvedContainerHeightPx}px`,
          minHeight: `${resolvedContainerHeightPx}px`,
          maxHeight: `${resolvedContainerHeightPx}px`,
        }}
      >
        <textarea
          id="character-manager-description"
          className="character-description-input"
          style={{
            ...CHARACTER_DESCRIPTION_INPUT_STYLE,
            padding: `${resolvedTextareaPaddingYpx}px 4px`,
          }}
          rows={rows}
          value={description}
          maxLength={maxLength}
          onChange={(event) => onChangeDescription(event.target.value)}
          placeholder="A gorgeous woman in her early 30s with brown hair and dark amber eyes, she has a slim, toned waist, a curvy lower body, and thick thighs."
          disabled={disabled}
        />
        <p
          className="character-description-count tiny subdued"
          style={CHARACTER_DESCRIPTION_COUNT_STYLE}
        >
          {description.length}/{maxLength}
        </p>
      </div>
      <div
        className="character-description-footer-row"
        style={{
          ...CHARACTER_DESCRIPTION_HELPER_ROW_STYLE,
          minHeight: `${resolvedFooterMinHeightPx}px`,
        }}
      >
        {helperText ? (
          <p className="character-description-helper tiny subdued">{helperText}</p>
        ) : null}
      </div>
    </div>
  );
}
