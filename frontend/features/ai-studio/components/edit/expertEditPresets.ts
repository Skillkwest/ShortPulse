/**
 * Preset label constants for the Expert Edit toolbar and overflow surface.
 */
export const EDIT_PRESET_MORE_LABEL = "More presets" as const;
export const EDIT_PRESET_PANEL_MAX = 11;
export const EXPERT_EDIT_PRESET_DRAG_MIME = "application/x-shortpulse-expert-edit-preset";

const EDIT_PRESET_NON_CUSTOM_LABELS = [
  "Selfie",
  "Side Profile",
  "Over Shoulder",
  "From Behind",
  "Low Angle",
  "Drone View",
  "Zoom In",
  "Zoom Out",
  "Enhance Realism",
] as const;

const EDIT_PRESET_CUSTOM_SURFACE_LABELS = Array.from(
  { length: 18 },
  (_, index) => `Custom ${index + 1}`
);

export const EDIT_PRESET_SURFACE_LABELS: readonly string[] = [
  ...EDIT_PRESET_NON_CUSTOM_LABELS,
  ...EDIT_PRESET_CUSTOM_SURFACE_LABELS,
];

export type ExpertEditPresetDragSource = "surface" | "panel";
export type ExpertEditPresetDragPayload = {
  label: string;
  source: ExpertEditPresetDragSource;
};

const PRESET_ORDER_INDEX = new Map(
  EDIT_PRESET_SURFACE_LABELS.map((label, index) => [label, index] as const)
);

const isValidPresetLabel = (value: string): value is (typeof EDIT_PRESET_SURFACE_LABELS)[number] =>
  PRESET_ORDER_INDEX.has(value);

const isValidPresetDragSource = (value: string): value is ExpertEditPresetDragSource =>
  value === "surface" || value === "panel";

/**
 * Converts any preset label list into deduped canonical order.
 */
export const sortPresetLabelsByCanonicalOrder = (labels: readonly string[]) => {
  const deduped = Array.from(new Set(labels)).filter(isValidPresetLabel);
  deduped.sort(
    (left, right) =>
      (PRESET_ORDER_INDEX.get(left) ?? 9999) - (PRESET_ORDER_INDEX.get(right) ?? 9999)
  );
  return deduped;
};

/**
 * Encodes Expert Edit preset drag data into a string payload.
 */
export const serializeExpertEditPresetDragPayload = (payload: ExpertEditPresetDragPayload) =>
  JSON.stringify(payload);

/**
 * Parses Expert Edit preset drag data from DataTransfer.
 */
export const parseExpertEditPresetDragPayload = (
  transfer: DataTransfer | null | undefined
): ExpertEditPresetDragPayload | null => {
  if (!transfer) return null;
  const raw = transfer.getData(EXPERT_EDIT_PRESET_DRAG_MIME).trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ExpertEditPresetDragPayload>;
    const label = typeof parsed.label === "string" ? parsed.label.trim() : "";
    const source = typeof parsed.source === "string" ? parsed.source.trim() : "";
    if (!isValidPresetLabel(label)) return null;
    if (!isValidPresetDragSource(source)) return null;
    return { label, source };
  } catch {
    return null;
  }
};
