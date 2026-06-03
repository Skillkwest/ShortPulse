/**
 * Elements description editor card.
 * Mirrors the Character editor card anatomy with Elements-specific copy and magenta accents.
 */
import React from "react";
import { ELEMENT_PANEL_ACCENT_LABEL } from "../constants";

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
type ElementsDescriptionEditorCardProps = {
  description: string;
  maxLength: number;
  containerHeightPx?: number;
  onChangeDescription: (value: string) => void;
};

/**
 * Renders the Elements description editor with unchanged label, helper, and counter behavior.
 */
export function ElementsDescriptionEditorCard({
  description,
  maxLength,
  containerHeightPx,
  onChangeDescription,
}: ElementsDescriptionEditorCardProps) {
  const resolvedContainerHeightPx =
    containerHeightPx ?? Number.parseFloat(ELEMENTS_DESCRIPTION_DROP_ZONE_HEIGHT);
  const resolvedContainerPaddingTopPx = 14;
  const resolvedContainerPaddingXpx = 16;
  const resolvedContainerPaddingBottomPx = 30;
  const resolvedTextareaPaddingYpx = 6;
  const showPlaceholder = description.length === 0;

  return (
    <div
      className="elements-profile-field"
      style={{
        ...ELEMENTS_DESCRIPTION_CARD_STYLE,
      }}
    >
      <div className="elements-description-label-row" style={ELEMENTS_DESCRIPTION_LABEL_ROW_STYLE}>
        <label htmlFor="element-manager-description" style={ELEMENTS_DESCRIPTION_LABEL_STYLE}>
          Description:
        </label>
      </div>
      <div
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
          rows={5}
          value={description}
          maxLength={maxLength}
          onChange={(event) => onChangeDescription(event.target.value)}
          placeholder=""
          disabled={false}
        />
        <p
          className="elements-description-count tiny subdued"
          style={ELEMENTS_DESCRIPTION_COUNT_STYLE}
        >
          {description.length}/{maxLength}
        </p>
      </div>
      <div
        style={{
          ...ELEMENTS_DESCRIPTION_HELPER_ROW_STYLE,
        }}
      />
    </div>
  );
}
