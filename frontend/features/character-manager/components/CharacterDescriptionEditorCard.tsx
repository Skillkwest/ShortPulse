/**
 * Character description editor card.
 * Renders the look-scoped description input, helper tip, and character counter.
 */
import React from "react";

const CHARACTER_DESCRIPTION_INPUT_BACKGROUND = "rgba(31, 35, 41, 0.82)";
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

const CHARACTER_DESCRIPTION_PLACEHOLDER_STYLE: React.CSSProperties = {
  position: "absolute",
  top: "20px",
  left: "20px",
  right: "20px",
  margin: 0,
  color: "rgba(175, 187, 200, 0.52)",
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  fontSize: "0.96rem",
  lineHeight: 1.58,
  fontStyle: "italic",
  fontWeight: 400,
  letterSpacing: "0.003em",
  pointerEvents: "none",
  whiteSpace: "pre-wrap",
};

const CHARACTER_DESCRIPTION_CARD_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "8px",
  minWidth: 0,
};

const CHARACTER_DESCRIPTION_LABEL_ROW_STYLE: React.CSSProperties = {
  marginBottom: "2px",
};

const CHARACTER_DESCRIPTION_LABEL_STYLE: React.CSSProperties = {
  display: "block",
  margin: 0,
  marginBottom: "3px",
  color: "#25a9bf",
  fontFamily:
    '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif',
  fontSize: "0.84rem",
  lineHeight: 1.16,
  fontWeight: 400,
  letterSpacing: "0.08em",
};

const CHARACTER_DESCRIPTION_COUNT_STYLE: React.CSSProperties = {
  position: "absolute",
  right: "12px",
  bottom: "10px",
  margin: 0,
  color: "rgba(183, 190, 204, 0.78)",
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  fontSize: "12px",
  lineHeight: 1.4,
};

const CHARACTER_DESCRIPTION_HELPER_ROW_STYLE: React.CSSProperties = {
  minHeight: "14px",
};

const CHARACTER_DESCRIPTION_HELPER_STYLE: React.CSSProperties = {
  margin: 0,
  color: "rgba(116, 255, 169, 0.96)",
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  fontSize: "12px",
  lineHeight: 1.4,
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
  const showPlaceholder = description.length === 0;

  return (
    <div
      style={{
        ...CHARACTER_DESCRIPTION_CARD_STYLE,
        gap: `${cardGapPx ?? 8}px`,
      }}
    >
      <div style={CHARACTER_DESCRIPTION_LABEL_ROW_STYLE}>
        <label htmlFor="character-manager-description" style={CHARACTER_DESCRIPTION_LABEL_STYLE}>
          Description:
        </label>
      </div>
      <div
        style={{
          ...CHARACTER_DESCRIPTION_TEXT_CONTAINER_STYLE,
          padding: `${resolvedContainerPaddingTopPx}px ${resolvedContainerPaddingXpx}px ${resolvedContainerPaddingBottomPx}px`,
          height: `${resolvedContainerHeightPx}px`,
          minHeight: `${resolvedContainerHeightPx}px`,
          maxHeight: `${resolvedContainerHeightPx}px`,
        }}
      >
        {showPlaceholder ? (
          <p
            aria-hidden="true"
            style={{
              ...CHARACTER_DESCRIPTION_PLACEHOLDER_STYLE,
              top: `${resolvedContainerPaddingTopPx + resolvedTextareaPaddingYpx}px`,
              left: `${resolvedContainerPaddingXpx + 4}px`,
              right: `${resolvedContainerPaddingXpx + 4}px`,
            }}
          >
            A gorgeous woman in her early 30s with brown hair and dark amber eyes, she has a slim,
            toned waist, a curvy lower body, and thick thighs.
          </p>
        ) : null}
        <textarea
          id="character-manager-description"
          style={{
            ...CHARACTER_DESCRIPTION_INPUT_STYLE,
            padding: `${resolvedTextareaPaddingYpx}px 4px`,
          }}
          rows={rows}
          value={description}
          maxLength={maxLength}
          onChange={(event) => onChangeDescription(event.target.value)}
          placeholder=""
          disabled={disabled}
        />
        <p style={CHARACTER_DESCRIPTION_COUNT_STYLE}>
          {description.length}/{maxLength}
        </p>
      </div>
      <div
        style={{
          ...CHARACTER_DESCRIPTION_HELPER_ROW_STYLE,
          minHeight: `${resolvedFooterMinHeightPx}px`,
        }}
      >
        {helperText ? <p style={CHARACTER_DESCRIPTION_HELPER_STYLE}>{helperText}</p> : null}
      </div>
    </div>
  );
}
