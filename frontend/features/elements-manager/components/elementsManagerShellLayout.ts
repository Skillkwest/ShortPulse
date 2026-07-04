/**
 * Static layout tokens for the Elements Manager shell.
 */
import type { CSSProperties } from "react";
import {
  ELEMENT_PANEL_ACCENT,
  ELEMENT_PANEL_ACCENT_FAINT,
  ELEMENT_PANEL_ACCENT_LABEL,
  ELEMENT_PANEL_ACCENT_PROGRESS_TEXT,
  ELEMENT_PANEL_ACCENT_SOFT,
} from "../constants";

export const IMAGE_REFERENCE_SLOT_LABELS = [
  "Primary View",
  "Secondary View",
  "Detail View",
] as const;
export const DND_ELEMENT_REFERENCE_SLOT_INDEX =
  "application/x-shortpulse-element-reference-slot-index";
export const ELEMENT_REFERENCE_DRAG_GHOST_SCALE = 0.74;
export const ELEMENT_REFERENCE_DRAG_GHOST_SELECTOR =
  ".elements-reference-media, .elements-reference-image";
export const ELEMENT_DESCRIPTION_MAX_LENGTH = 150;
export const ELEMENT_LIBRARY_AVATAR_SIZE_PX = 44;
export const ELEMENT_SAVE_SUCCESS_BADGE_DURATION_MS = 2200;
export const ELEMENT_PANEL_FIELD_BORDER_COLOR = "rgba(34, 40, 49, 0.96)";

const ELEMENT_PANEL_SHELL_BACKGROUND = "rgba(31, 35, 40, 0.94)";
const ELEMENT_PANEL_FIELD_BACKGROUND = "#131518";
const ELEMENT_FOLDER_ICON_SIZE_PX = 20;
export const ELEMENT_TOP_ACTION_BUTTON_SIDE_PX = 38;

export const ELEMENT_BUTTON_INLINE_STYLE: CSSProperties = {
  minWidth: "152px",
  minHeight: "48px",
  padding: "0 20px",
  borderRadius: "14px",
  fontSize: "0.9rem",
  flexShrink: 0,
  border: `1px solid ${ELEMENT_PANEL_ACCENT}`,
  background: "rgba(28, 32, 37, 0.94)",
  color: ELEMENT_PANEL_ACCENT_SOFT,
  boxShadow: "0 6px 14px rgba(0, 0, 0, 0.18)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 600,
  cursor: "pointer",
};
export const ELEMENT_SAVE_ACTION_BUTTON_INLINE_STYLE: CSSProperties = {
  borderColor: ELEMENT_PANEL_ACCENT,
  background: "rgba(255, 123, 167, 0.16)",
  backgroundColor: "rgba(255, 123, 167, 0.16)",
  color: ELEMENT_PANEL_ACCENT_SOFT,
  boxShadow: `0 8px 18px rgba(255, 123, 167, 0.18), 0 0 0 1px ${ELEMENT_PANEL_ACCENT_FAINT}`,
};
export const ELEMENT_CREATE_ACTION_BUTTON_INLINE_STYLE: CSSProperties = {
  borderColor: "rgba(201, 205, 214, 0.42)",
  background: "rgba(201, 205, 214, 0.14)",
  backgroundColor: "rgba(201, 205, 214, 0.14)",
  color: "rgba(242, 246, 252, 0.94)",
  boxShadow: "0 6px 14px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(255, 255, 255, 0.04)",
};
export const ELEMENT_TOP_ROW_ACTIONS_INLINE_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  flexWrap: "wrap",
  width: "100%",
  minWidth: 0,
};
export const ELEMENT_TOP_ROW_PRIMARY_ACTIONS_INLINE_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};
export const ELEMENT_TOP_ROW_SECONDARY_ACTIONS_INLINE_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
  flex: "1 1 0",
  minWidth: 0,
  marginLeft: "auto",
};
export const ELEMENT_FOLDER_ICON_INLINE_STYLE: CSSProperties = {
  flex: `0 0 ${ELEMENT_FOLDER_ICON_SIZE_PX}px`,
  width: `${ELEMENT_FOLDER_ICON_SIZE_PX}px`,
  height: `${ELEMENT_FOLDER_ICON_SIZE_PX}px`,
  minWidth: `${ELEMENT_FOLDER_ICON_SIZE_PX}px`,
  minHeight: `${ELEMENT_FOLDER_ICON_SIZE_PX}px`,
  maxWidth: `${ELEMENT_FOLDER_ICON_SIZE_PX}px`,
  maxHeight: `${ELEMENT_FOLDER_ICON_SIZE_PX}px`,
  display: "block",
};
export const ELEMENT_BUTTON_LABEL_INLINE_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  lineHeight: 1,
  minHeight: "20px",
};
export const ELEMENT_EDITOR_FIELDS_WRAPPER_STYLE: CSSProperties = {
  display: "grid",
  gap: "16px",
  marginTop: "2px",
  padding: "12px 8px 3px",
  borderRadius: "15px",
  border: "1px solid rgba(30, 35, 43, 0.96)",
  background: ELEMENT_PANEL_SHELL_BACKGROUND,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
};
export const ELEMENT_TOP_FIELD_GROUP_INLINE_STYLE: CSSProperties = {
  display: "grid",
  gap: "4px",
  alignContent: "start",
  minWidth: 0,
};
export const ELEMENT_TOP_FIELD_LABEL_INLINE_STYLE: CSSProperties = {
  margin: 0,
};
export const ELEMENT_TOP_FIELD_LABEL_TEXT_INLINE_STYLE: CSSProperties = {
  display: "block",
  margin: 0,
  color: ELEMENT_PANEL_ACCENT_LABEL,
  textShadow: "0 1px 4px rgba(0, 0, 0, 0.32)",
  fontFamily:
    '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif',
  fontSize: "0.84rem",
  lineHeight: 1.16,
  fontWeight: 400,
  letterSpacing: "0.06em",
};
export const ELEMENT_TOP_FIELD_CONTROL_INLINE_STYLE: CSSProperties = {
  minWidth: 0,
};
export const ELEMENT_NAME_INPUT_INLINE_STYLE: CSSProperties = {
  height: "36px",
  minHeight: "36px",
  padding: "6px 10px",
  width: "100%",
  borderRadius: "10px",
  border: `1px solid ${ELEMENT_PANEL_FIELD_BORDER_COLOR}`,
  background: ELEMENT_PANEL_FIELD_BACKGROUND,
  color: "rgba(242, 246, 252, 0.96)",
  boxSizing: "border-box",
};
export const ELEMENT_EDITOR_CONTENT_GRID_INLINE_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.02fr) minmax(0, 0.98fr)",
  gridTemplateAreas: '"name empty" "description references"',
  columnGap: "34px",
  rowGap: "18px",
  alignItems: "start",
};
export const ELEMENT_TOP_SECTION_CONTENT_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  padding: "10px 16px 5px",
  boxSizing: "border-box",
};
export const ELEMENT_NAME_COLUMN_INLINE_STYLE: CSSProperties = {
  gridArea: "name",
  minWidth: 0,
};
export const ELEMENT_DESCRIPTION_COLUMN_INLINE_STYLE: CSSProperties = {
  gridArea: "description",
  minWidth: 0,
  display: "grid",
  alignContent: "start",
};
export const ELEMENT_REFERENCE_COLUMN_INLINE_STYLE: CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: "10px",
  minWidth: 0,
  gridArea: "references",
};
export const ELEMENT_REFERENCE_TITLE_INLINE_STYLE: CSSProperties = {
  display: "grid",
  gap: "2px",
  margin: "0 0 4px",
};
export const ELEMENT_REFERENCE_GRID_INLINE_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px",
  alignItems: "start",
};
export const ELEMENT_REFERENCE_CARD_INLINE_STYLE: CSSProperties = {
  width: "100%",
  maxWidth: "156px",
  minHeight: 0,
  aspectRatio: "4 / 5",
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr) 30px",
  borderRadius: "10px",
  border: `1px solid ${ELEMENT_PANEL_FIELD_BORDER_COLOR}`,
  background: "rgba(12, 14, 19, 0.96)",
  boxShadow: "0 14px 30px rgba(0, 0, 0, 0.28), 0 3px 8px rgba(0, 0, 0, 0.18)",
  overflow: "hidden",
  position: "relative",
  boxSizing: "border-box",
  alignSelf: "start",
  justifySelf: "stretch",
};
export const ELEMENT_REFERENCE_SLOT_ACTIONS_INLINE_STYLE: CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  zIndex: 2,
};
export const ELEMENT_REFERENCE_DELETE_BUTTON_INLINE_STYLE: CSSProperties = {
  width: "18px",
  height: "18px",
  borderRadius: "999px",
  border: "1px solid rgba(187, 71, 108, 0.9)",
  background: "rgba(69, 18, 35, 0.94)",
  color: "rgba(255, 214, 227, 0.98)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  cursor: "pointer",
  boxShadow: `0 0 0 1px ${ELEMENT_PANEL_ACCENT_FAINT}`,
};
export const ELEMENT_REFERENCE_MEDIA_INLINE_STYLE: CSSProperties = {
  height: "100%",
  minHeight: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "14px 10px 8px",
  background: "rgba(12, 14, 19, 0.96)",
  borderBottom: "none",
  aspectRatio: "auto",
  boxSizing: "border-box",
};
export const ELEMENT_REFERENCE_MEDIA_FILLED_INLINE_STYLE: CSSProperties = {
  alignItems: "stretch",
  justifyContent: "stretch",
  padding: 0,
};
export const ELEMENT_REFERENCE_IMAGE_INLINE_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
  objectFit: "cover",
};
export const ELEMENT_REFERENCE_DROP_COPY_INLINE_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "4px",
  paddingInline: "8px",
  textAlign: "center",
  color: "rgba(137, 145, 161, 0.8)",
  fontSize: "0.78rem",
  lineHeight: 1.32,
  whiteSpace: "pre-line",
};
export const ELEMENT_REFERENCE_DROP_REQUIREMENT_BASE_STYLE: CSSProperties = {
  marginTop: "2px",
  fontSize: "0.76rem",
  fontWeight: 700,
};
export const ELEMENT_REFERENCE_HINT_INLINE_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "22px",
  padding: "0 8px",
  borderTop: "1px dashed rgba(50, 57, 67, 0.9)",
  background: ELEMENT_PANEL_FIELD_BACKGROUND,
  color: "rgba(150, 159, 176, 0.82)",
  fontSize: "0.74rem",
  fontWeight: 600,
  lineHeight: 1.1,
  textAlign: "center",
  boxSizing: "border-box",
};
export const ELEMENT_SECONDARY_ACTION_BUTTON_INLINE_STYLE: CSSProperties = {
  minWidth: "84px",
  minHeight: "30px",
  padding: "0 8px",
  fontSize: "0.72rem",
  gap: "4px",
};
export const ELEMENT_SAVE_ICON_BUTTON_INLINE_STYLE: CSSProperties = {
  width: `${ELEMENT_TOP_ACTION_BUTTON_SIDE_PX}px`,
  minWidth: `${ELEMENT_TOP_ACTION_BUTTON_SIDE_PX}px`,
  maxWidth: `${ELEMENT_TOP_ACTION_BUTTON_SIDE_PX}px`,
  height: `${ELEMENT_TOP_ACTION_BUTTON_SIDE_PX}px`,
  minHeight: `${ELEMENT_TOP_ACTION_BUTTON_SIDE_PX}px`,
  maxHeight: `${ELEMENT_TOP_ACTION_BUTTON_SIDE_PX}px`,
  padding: 0,
  borderRadius: "12px",
};
export const ELEMENT_TOP_ACTION_BUTTON_TRANSITION =
  "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease";
export const ELEMENT_SAVE_SUCCESS_BADGE_INLINE_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minHeight: "28px",
  padding: "0 10px",
  borderRadius: "999px",
  border: "1px solid rgba(231, 92, 134, 0.22)",
  background: "rgba(55, 17, 34, 0.54)",
  color: ELEMENT_PANEL_ACCENT_PROGRESS_TEXT,
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.01em",
};
export const ELEMENT_SAVE_PROGRESS_BADGE_INLINE_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "7px",
  minHeight: "28px",
  padding: "0 10px",
  borderRadius: "999px",
  border: "1px solid rgba(231, 92, 134, 0.28)",
  background: "rgba(70, 20, 41, 0.62)",
  color: ELEMENT_PANEL_ACCENT_PROGRESS_TEXT,
  boxShadow: `0 0 0 1px ${ELEMENT_PANEL_ACCENT_FAINT}`,
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0",
  whiteSpace: "nowrap",
};

export const buildElementInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!words.length) return "EL";
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
};
