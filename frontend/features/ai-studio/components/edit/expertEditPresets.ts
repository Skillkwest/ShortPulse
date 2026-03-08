/**
 * Canonical Expert Edit preset catalog and helpers.
 * Provides stable preset IDs, drag payload encoding, and custom override resolution.
 */
export const EDIT_PRESET_MORE_LABEL = "More presets" as const;
export const EDIT_PRESET_COMPOSITE_GENERATE_LABEL = "Composite & Generate" as const;
export const EDIT_PRESET_PANEL_MAX = 11;
export const EXPERT_EDIT_PRESET_DRAG_MIME = "application/x-shortpulse-expert-edit-preset";
export const EDIT_PRESET_COMPOSITE_GENERATE_PROMPT =
  "Using the flattened composite from the primary staging viewport (all visible layers) as reference, regenerate one cohesive final image where every subject and element naturally belongs in the same scene. Preserve core identities and intended placement, but remove collage/cutout artifacts, mismatched edges, and layering seams. Unify perspective, scale, color temperature, lighting direction, exposure, and shadow behavior so the result reads as one realistic photograph. Add believable depth, contact shadows, and natural character-to-character/environment interaction for a seamless, photoreal final composition.";

const EDIT_PRESET_NON_CUSTOM_DEFINITIONS = [
  {
    presetId: "selfie",
    label: "Selfie",
    prompt:
      "Make the figure hold the camera in a selfie-style perspective. Keep the framing tight and realistic so it feels like the camera is in the figure's hand, with the subject looking directly into the lens.",
  },
  {
    presetId: "side_profile",
    label: "Side Profile",
    prompt:
      "Compose the subject in a clean side-profile pose, emphasizing the silhouette from forehead to chin with the face turned 90 degrees from camera.",
  },
  {
    presetId: "over_shoulder",
    label: "Over Shoulder",
    prompt:
      "Frame the shot from over the subject's shoulder so the near shoulder anchors the foreground while the face and scene remain readable in the midground.",
  },
  {
    presetId: "from_behind",
    label: "From Behind",
    prompt:
      "Position the camera behind the subject so we primarily see the back of the head and body, with subtle head turn only if needed for context.",
  },
  {
    presetId: "low_angle",
    label: "Low Angle",
    prompt:
      "Use a low-angle camera position looking upward at the subject to create stronger presence and scale while keeping anatomy and proportions natural.",
  },
  {
    presetId: "drone_view",
    label: "Drone View",
    prompt:
      "Use a high aerial perspective, as if shot from a drone, looking downward with wide environmental context and clear subject placement.",
  },
  {
    presetId: "zoom_in",
    label: "Zoom In",
    prompt:
      "Zoom in for a tighter composition focused on the subject's face and upper body, reducing background clutter while preserving sharp detail.",
  },
  {
    presetId: "zoom_out",
    label: "Zoom Out",
    prompt:
      "Zoom out to a wider composition that includes more environment and negative space while keeping the subject clearly identifiable.",
  },
  {
    presetId: "enhance_realism",
    label: "Enhance Realism",
    prompt:
      "Increase photographic realism with natural skin texture, believable lighting falloff, accurate shadows, subtle lens behavior, and physically plausible detail.",
  },
] as const;

const EDIT_PRESET_CUSTOM_PROMPTS = [
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
] as const;

const EDIT_PRESET_CUSTOM_DEFINITIONS = EDIT_PRESET_CUSTOM_PROMPTS.map((prompt, index) => {
  const customNumber = index + 1;
  return {
    presetId: `custom_${customNumber}`,
    label: `Custom ${customNumber}`,
    prompt,
  } as const;
});

const EDIT_PRESET_BASE_DEFINITIONS = [
  ...EDIT_PRESET_NON_CUSTOM_DEFINITIONS,
  ...EDIT_PRESET_CUSTOM_DEFINITIONS,
] as const;

export type ExpertEditPresetId = (typeof EDIT_PRESET_BASE_DEFINITIONS)[number]["presetId"];
export type ExpertEditCustomPresetId = Extract<ExpertEditPresetId, `custom_${number}`>;

export type ExpertEditCustomPresetOverride = {
  label: string;
  prompt: string;
};

export type ExpertEditCustomPresetOverrides = Partial<
  Record<ExpertEditCustomPresetId, ExpertEditCustomPresetOverride>
>;

export type ExpertEditResolvedPreset = {
  presetId: ExpertEditPresetId;
  label: string;
  prompt: string;
  isCustom: boolean;
};

export type ExpertEditPresetDragSource = "surface" | "panel";
export type ExpertEditPresetDragPayload = {
  presetId: ExpertEditPresetId;
  source: ExpertEditPresetDragSource;
};

const EDIT_PRESET_BASE_BY_ID = new Map(
  EDIT_PRESET_BASE_DEFINITIONS.map((definition) => [definition.presetId, definition] as const)
);

const EDIT_PRESET_ID_INDEX = new Map(
  EDIT_PRESET_BASE_DEFINITIONS.map((definition, index) => [definition.presetId, index] as const)
);

const LEGACY_LABEL_TO_ID = new Map(
  EDIT_PRESET_BASE_DEFINITIONS.map((definition) => [
    definition.label.trim().toLowerCase(),
    definition.presetId,
  ])
);

const isValidPresetDragSource = (value: string): value is ExpertEditPresetDragSource =>
  value === "surface" || value === "panel";

const normalizeCustomOverrideLabel = (value: string) => value.trim();
const normalizeCustomOverridePrompt = (value: string) => value.trim();

/**
 * Ordered canonical list of all Expert Edit preset IDs.
 */
export const EDIT_PRESET_SURFACE_PRESET_IDS = EDIT_PRESET_BASE_DEFINITIONS.map(
  (definition) => definition.presetId
) as readonly ExpertEditPresetId[];

/**
 * Ordered canonical list of editable custom preset IDs.
 */
export const EDIT_PRESET_CUSTOM_PRESET_IDS = EDIT_PRESET_CUSTOM_DEFINITIONS.map(
  (definition) => definition.presetId
) as readonly ExpertEditCustomPresetId[];

/**
 * Seeded default Expert Edit preset panel IDs.
 */
export const EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS = [
  "selfie",
  "side_profile",
  "enhance_realism",
] as const satisfies readonly ExpertEditPresetId[];

/**
 * Legacy label constants kept for fallback/migration helpers.
 */
export const EDIT_PRESET_SURFACE_LABELS = EDIT_PRESET_SURFACE_PRESET_IDS.map(
  (presetId) => EDIT_PRESET_BASE_BY_ID.get(presetId)?.label ?? presetId
);

/**
 * Legacy seeded labels kept for fallback/migration helpers.
 */
export const EDIT_PRESET_DEFAULT_PANEL_LABELS = EDIT_PRESET_DEFAULT_PANEL_PRESET_IDS.map(
  (presetId) => EDIT_PRESET_BASE_BY_ID.get(presetId)?.label ?? presetId
);

/**
 * Returns true when a string is a known Expert Edit preset ID.
 */
export const isExpertEditPresetId = (value: string): value is ExpertEditPresetId =>
  EDIT_PRESET_BASE_BY_ID.has(value as ExpertEditPresetId);

/**
 * Returns true when a string is an editable custom preset ID.
 */
export const isExpertEditCustomPresetId = (value: string): value is ExpertEditCustomPresetId =>
  value.startsWith("custom_") &&
  EDIT_PRESET_CUSTOM_PRESET_IDS.includes(value as ExpertEditCustomPresetId);

/**
 * Maps a legacy label (for migration/fallback paths) to a canonical preset ID.
 */
export const mapLegacyPresetLabelToId = (label: string): ExpertEditPresetId | null => {
  const normalizedLabel = label.trim().toLowerCase();
  if (!normalizedLabel) return null;
  return LEGACY_LABEL_TO_ID.get(normalizedLabel) ?? null;
};

/**
 * Maps legacy preset labels to canonical ordered preset IDs.
 */
export const mapLegacyPresetLabelsToIds = (labels: readonly string[]): ExpertEditPresetId[] => {
  const resolvedPresetIds = labels
    .map((label) => mapLegacyPresetLabelToId(label))
    .filter((presetId): presetId is ExpertEditPresetId => presetId != null);
  return sortPresetIdsByCanonicalOrder(resolvedPresetIds);
};

/**
 * Converts any preset ID list into deduped canonical order.
 */
export const sortPresetIdsByCanonicalOrder = (
  presetIds: readonly string[]
): ExpertEditPresetId[] => {
  const deduped = Array.from(new Set(presetIds)).filter(
    (presetId): presetId is ExpertEditPresetId => isExpertEditPresetId(presetId)
  );
  deduped.sort(
    (left, right) =>
      (EDIT_PRESET_ID_INDEX.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (EDIT_PRESET_ID_INDEX.get(right) ?? Number.MAX_SAFE_INTEGER)
  );
  return deduped;
};

/**
 * Normalizes panel preset IDs to known, deduped, canonical ordered IDs and applies max capacity.
 */
export const normalizePresetPanelPresetIds = (presetIds: readonly string[]): ExpertEditPresetId[] =>
  sortPresetIdsByCanonicalOrder(presetIds).slice(0, EDIT_PRESET_PANEL_MAX);

/**
 * Legacy helper kept for compatibility in fallback tests/paths.
 */
export const sortPresetLabelsByCanonicalOrder = (labels: readonly string[]) =>
  mapLegacyPresetLabelsToIds(labels).map(
    (presetId) => EDIT_PRESET_BASE_BY_ID.get(presetId)?.label ?? presetId
  );

/**
 * Normalizes custom preset overrides to known custom preset IDs with non-empty label/prompt.
 */
export const normalizeExpertEditCustomPresetOverrides = (
  value: unknown
): ExpertEditCustomPresetOverrides => {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value as Record<string, unknown>);
  const normalized: ExpertEditCustomPresetOverrides = {};
  entries.forEach(([rawPresetId, rawOverride]) => {
    if (!isExpertEditCustomPresetId(rawPresetId)) return;
    if (!rawOverride || typeof rawOverride !== "object") return;
    const candidateLabel =
      typeof (rawOverride as { label?: unknown }).label === "string"
        ? normalizeCustomOverrideLabel((rawOverride as { label: string }).label)
        : "";
    const candidatePrompt =
      typeof (rawOverride as { prompt?: unknown }).prompt === "string"
        ? normalizeCustomOverridePrompt((rawOverride as { prompt: string }).prompt)
        : "";
    if (!candidateLabel || !candidatePrompt) return;
    normalized[rawPresetId] = {
      label: candidateLabel,
      prompt: candidatePrompt,
    };
  });
  return normalized;
};

/**
 * Resolves a preset definition by ID with optional custom overrides applied.
 */
export const resolveExpertEditPresetById = (
  presetId: ExpertEditPresetId,
  customOverrides?: ExpertEditCustomPresetOverrides | null
): ExpertEditResolvedPreset => {
  const baseDefinition = EDIT_PRESET_BASE_BY_ID.get(presetId);
  if (!baseDefinition) {
    return {
      presetId,
      label: presetId,
      prompt: "",
      isCustom: false,
    };
  }

  const isCustom = isExpertEditCustomPresetId(presetId);
  const override = isCustom ? customOverrides?.[presetId] : undefined;
  return {
    presetId,
    label: override?.label ?? baseDefinition.label,
    prompt: override?.prompt ?? baseDefinition.prompt,
    isCustom,
  };
};

/**
 * Resolves a preset label by ID with optional custom overrides applied.
 */
export const resolveExpertEditPresetLabelById = (
  presetId: ExpertEditPresetId,
  customOverrides?: ExpertEditCustomPresetOverrides | null
): string => resolveExpertEditPresetById(presetId, customOverrides).label;

/**
 * Resolves a preset prompt by ID with optional custom overrides applied.
 */
export const resolveExpertEditPresetPromptById = (
  presetId: ExpertEditPresetId,
  customOverrides?: ExpertEditCustomPresetOverrides | null
): string | null => {
  const prompt = resolveExpertEditPresetById(presetId, customOverrides).prompt;
  return prompt.trim().length > 0 ? prompt : null;
};

/**
 * Resolves prompt text from either a preset ID or a legacy preset label.
 */
export const resolveExpertEditPresetPrompt = (
  preset: string,
  customOverrides?: ExpertEditCustomPresetOverrides | null
): string | null => {
  const normalizedPreset = preset.trim();
  if (!normalizedPreset) return null;
  if (isExpertEditPresetId(normalizedPreset)) {
    return resolveExpertEditPresetPromptById(normalizedPreset, customOverrides);
  }
  const presetId = mapLegacyPresetLabelToId(normalizedPreset);
  if (!presetId) return null;
  return resolveExpertEditPresetPromptById(presetId, customOverrides);
};

/**
 * Resolves all presets with optional custom overrides applied.
 */
export const resolveExpertEditPresetCatalog = (
  customOverrides?: ExpertEditCustomPresetOverrides | null
): ExpertEditResolvedPreset[] =>
  EDIT_PRESET_SURFACE_PRESET_IDS.map((presetId) =>
    resolveExpertEditPresetById(presetId, customOverrides)
  );

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
    const parsed = JSON.parse(raw) as Partial<ExpertEditPresetDragPayload> & { label?: string };
    const source = typeof parsed.source === "string" ? parsed.source.trim() : "";
    if (!isValidPresetDragSource(source)) return null;
    const presetIdFromPayload = typeof parsed.presetId === "string" ? parsed.presetId.trim() : "";
    if (isExpertEditPresetId(presetIdFromPayload)) {
      return { presetId: presetIdFromPayload, source };
    }
    const legacyLabel = typeof parsed.label === "string" ? parsed.label.trim() : "";
    const mappedPresetId = mapLegacyPresetLabelToId(legacyLabel);
    if (!mappedPresetId) return null;
    return { presetId: mappedPresetId, source };
  } catch {
    return null;
  }
};
