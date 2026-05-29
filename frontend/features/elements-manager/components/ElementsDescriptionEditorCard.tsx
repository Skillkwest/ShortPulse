/**
 * Elements description editor card.
 * Mirrors the Character editor card anatomy with Elements-specific copy and magenta accents.
 */
import React from "react";
import { ELEMENT_PANEL_ACCENT_HELPER, ELEMENT_PANEL_ACCENT_LABEL } from "../constants";

const ELEMENTS_DESCRIPTION_INPUT_BACKGROUND = "#131518";
const ELEMENTS_DESCRIPTION_BORDER = "rgba(34, 40, 49, 0.96)";
const ELEMENTS_DESCRIPTION_DROP_ZONE_HEIGHT = "142.5px";
const ELEMENTS_DESCRIPTION_LABEL_STYLE: React.CSSProperties = {
  display: "block",
  margin: 0,
  marginBottom: "3px",
  color: ELEMENT_PANEL_ACCENT_LABEL,
  fontFamily:
    '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif',
  fontSize: "0.84rem",
  lineHeight: 1.16,
  fontWeight: 400,
  letterSpacing: "0.08em",
  textShadow: "0 1px 4px rgba(0, 0, 0, 0.32)",
};
const ELEMENTS_DESCRIPTION_CARD_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "8px",
  minWidth: 0,
};
const ELEMENTS_DESCRIPTION_LABEL_ROW_STYLE: React.CSSProperties = {
  marginBottom: "2px",
};
const ELEMENTS_DESCRIPTION_TEXT_CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  padding: "14px 16px 30px",
  position: "relative",
  border: `1px solid ${ELEMENTS_DESCRIPTION_BORDER}`,
  borderRadius: "12px",
  background: ELEMENTS_DESCRIPTION_INPUT_BACKGROUND,
  height: ELEMENTS_DESCRIPTION_DROP_ZONE_HEIGHT,
  minHeight: ELEMENTS_DESCRIPTION_DROP_ZONE_HEIGHT,
  maxHeight: ELEMENTS_DESCRIPTION_DROP_ZONE_HEIGHT,
  boxSizing: "border-box",
};
const ELEMENTS_DESCRIPTION_INPUT_STYLE: React.CSSProperties = {
  flex: "1 1 auto",
  height: "100%",
  padding: "6px 4px",
  width: "100%",
  minHeight: 0,
  border: "none",
  outline: "none",
  resize: "none",
  background: ELEMENTS_DESCRIPTION_INPUT_BACKGROUND,
  color: "rgba(232, 236, 244, 0.96)",
  fontSize: "0.92rem",
  lineHeight: 1.45,
  boxSizing: "border-box",
};
const ELEMENTS_DESCRIPTION_PLACEHOLDER_STYLE: React.CSSProperties = {
  position: "absolute",
  top: "20px",
  bottom: "34px",
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
  overflow: "hidden",
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 3,
};
const ELEMENTS_DESCRIPTION_COUNT_STYLE: React.CSSProperties = {
  position: "absolute",
  right: "12px",
  bottom: "10px",
  margin: 0,
  color: "rgba(183, 190, 204, 0.78)",
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  fontSize: "12px",
  lineHeight: 1.4,
};
const ELEMENTS_DESCRIPTION_HELPER_ROW_STYLE: React.CSSProperties = {
  minHeight: "14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
};
const ELEMENTS_DESCRIPTION_HELPER_STYLE: React.CSSProperties = {
  margin: 0,
  color: ELEMENT_PANEL_ACCENT_HELPER,
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  fontSize: "12px",
  lineHeight: 1.4,
};

type ElementsDescriptionEditorCardProps = {
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
 * Renders the Elements description editor with unchanged label, helper, and counter behavior.
 */
export function ElementsDescriptionEditorCard({
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
}: ElementsDescriptionEditorCardProps) {
  const resolvedContainerHeightPx =
    containerHeightPx ?? Number.parseFloat(ELEMENTS_DESCRIPTION_DROP_ZONE_HEIGHT);
  const resolvedContainerPaddingTopPx = containerPaddingTopPx ?? 14;
  const resolvedContainerPaddingXpx = containerPaddingXpx ?? 16;
  const resolvedContainerPaddingBottomPx = containerPaddingBottomPx ?? 30;
  const resolvedTextareaPaddingYpx = textareaPaddingYpx ?? 6;
  const resolvedFooterMinHeightPx = footerMinHeightPx ?? 14;
  const showPlaceholder = description.length === 0;

  return (
    <div
      className="elements-description-card elements-profile-fields"
      style={{
        ...ELEMENTS_DESCRIPTION_CARD_STYLE,
        gap: `${cardGapPx ?? 8}px`,
      }}
    >
      <div className="elements-description-label-row" style={ELEMENTS_DESCRIPTION_LABEL_ROW_STYLE}>
        <label htmlFor="element-manager-description" style={ELEMENTS_DESCRIPTION_LABEL_STYLE}>
          Description:
        </label>
      </div>
      <div
        className="elements-description-text-container"
        style={{
          ...ELEMENTS_DESCRIPTION_TEXT_CONTAINER_STYLE,
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
              ...ELEMENTS_DESCRIPTION_PLACEHOLDER_STYLE,
              top: `${resolvedContainerPaddingTopPx + resolvedTextareaPaddingYpx}px`,
              bottom: `${resolvedContainerPaddingBottomPx + 8}px`,
              left: `${resolvedContainerPaddingXpx + 4}px`,
              right: `${resolvedContainerPaddingXpx + 4}px`,
            }}
          >
            Describe the element&apos;s shape, materials, and visual identity.
          </p>
        ) : null}
        <textarea
          id="element-manager-description"
          className="elements-description-input"
          style={{
            ...ELEMENTS_DESCRIPTION_INPUT_STYLE,
            padding: `${resolvedTextareaPaddingYpx}px 4px`,
          }}
          rows={rows}
          value={description}
          maxLength={maxLength}
          onChange={(event) => onChangeDescription(event.target.value)}
          placeholder=""
          disabled={disabled}
        />
        <p
          className="elements-description-count tiny subdued"
          style={ELEMENTS_DESCRIPTION_COUNT_STYLE}
        >
          {description.length}/{maxLength}
        </p>
      </div>
      <div
        className="elements-description-footer-row"
        style={{
          ...ELEMENTS_DESCRIPTION_HELPER_ROW_STYLE,
          minHeight: `${resolvedFooterMinHeightPx}px`,
        }}
      >
        {helperText ? (
          <p
            className="elements-description-helper tiny subdued"
            style={ELEMENTS_DESCRIPTION_HELPER_STYLE}
          >
            {helperText}
          </p>
        ) : null}
      </div>
    </div>
  );
}
