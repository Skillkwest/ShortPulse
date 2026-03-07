/**
 * Preset label constants for the Expert Edit toolbar and overflow surface.
 */
export const EDIT_PRESET_MORE_LABEL = "More presets" as const;

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

export const EDIT_PRESET_TOOLBAR_LABELS = [
  ...EDIT_PRESET_NON_CUSTOM_LABELS,
  "Custom 1",
  "Custom 2",
  EDIT_PRESET_MORE_LABEL,
] as const;

export const EDIT_PRESET_SURFACE_LABELS: readonly string[] = [
  ...EDIT_PRESET_NON_CUSTOM_LABELS,
  ...EDIT_PRESET_CUSTOM_SURFACE_LABELS,
];
