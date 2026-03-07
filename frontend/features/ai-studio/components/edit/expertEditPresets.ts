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

export const EDIT_PRESET_DEFAULT_PANEL_LABELS: readonly string[] = [
  "Selfie",
  "Side Profile",
  "Enhance Realism",
];

const EDIT_PRESET_BASE_PROMPT_MAP: Record<string, string> = {
  Selfie:
    "Make the figure hold the camera in a selfie-style perspective. Keep the framing tight and realistic so it feels like the camera is in the figure's hand, with the subject looking directly into the lens.",
  "Side Profile":
    "Compose the subject in a clean side-profile pose, emphasizing the silhouette from forehead to chin with the face turned 90 degrees from camera.",
  "Over Shoulder":
    "Frame the shot from over the subject's shoulder so the near shoulder anchors the foreground while the face and scene remain readable in the midground.",
  "From Behind":
    "Position the camera behind the subject so we primarily see the back of the head and body, with subtle head turn only if needed for context.",
  "Low Angle":
    "Use a low-angle camera position looking upward at the subject to create stronger presence and scale while keeping anatomy and proportions natural.",
  "Drone View":
    "Use a high aerial perspective, as if shot from a drone, looking downward with wide environmental context and clear subject placement.",
  "Zoom In":
    "Zoom in for a tighter composition focused on the subject's face and upper body, reducing background clutter while preserving sharp detail.",
  "Zoom Out":
    "Zoom out to a wider composition that includes more environment and negative space while keeping the subject clearly identifiable.",
  "Enhance Realism":
    "Increase photographic realism with natural skin texture, believable lighting falloff, accurate shadows, subtle lens behavior, and physically plausible detail.",
};

const EDIT_PRESET_CUSTOM_PROMPTS: readonly string[] = [
  "Create a cinematic portrait framing with balanced key and fill light, keeping the subject centered and highly detailed.",
  "Create an editorial fashion composition with confident pose, refined lighting contrast, and polished high-end styling.",
  "Create a dramatic rim-lit look with stronger edge separation and controlled shadow depth while preserving facial detail.",
  "Create a soft natural-window-light look with gentle falloff, realistic skin texture, and clean background separation.",
  "Create a dynamic action-leaning pose with directional movement cues and a camera angle that adds energy to the frame.",
  "Create a studio beauty setup with even skin rendering, controlled highlights, and clean, minimal background styling.",
  "Create a moody low-key portrait with deeper shadows, selective highlights, and a cinematic atmosphere.",
  "Create a bright lifestyle look with airy lighting, natural color tones, and an approachable candid expression.",
  "Create a premium product-style composition where the subject is crisp, centered, and lit with high commercial clarity.",
  "Create a street-style candid framing with slight asymmetry, realistic environment context, and natural motion feel.",
  "Create a close-up character portrait focused on expression and eyes, with subtle depth-of-field and realistic detail.",
  "Create a full-body hero composition with strong posture, clear silhouette separation, and balanced scene geometry.",
  "Create a symmetrical centered composition with clean alignment, intentional negative space, and stable visual weight.",
  "Create a three-quarter angle portrait that flatters facial structure while preserving natural body proportions.",
  "Create a warm golden-hour aesthetic with realistic directional sunlight and soft ambient bounce light.",
  "Create a cool overcast aesthetic with diffused light, muted contrast, and natural tonal consistency.",
  "Create a high-contrast monochrome-inspired look while preserving fine texture and dimensional lighting.",
  "Create a polished social-media-ready portrait with flattering framing, clean lighting, and realistic finish.",
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

/**
 * Resolves the prompt text associated with an Expert Edit preset label.
 */
export const resolveExpertEditPresetPrompt = (label: string): string | null => {
  const normalizedLabel = label.trim();
  if (!normalizedLabel) return null;

  const mappedPrompt = EDIT_PRESET_BASE_PROMPT_MAP[normalizedLabel];
  if (typeof mappedPrompt === "string") {
    return mappedPrompt;
  }

  const customMatch = /^custom\s+(\d+)$/i.exec(normalizedLabel);
  if (!customMatch) return null;
  const customNumber = Number(customMatch[1]);
  if (!Number.isInteger(customNumber)) return null;
  if (customNumber < 1 || customNumber > EDIT_PRESET_CUSTOM_PROMPTS.length) return null;
  return EDIT_PRESET_CUSTOM_PROMPTS[customNumber - 1] ?? null;
};
