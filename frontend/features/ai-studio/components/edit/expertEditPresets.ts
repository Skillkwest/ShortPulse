/**
 * Canonical Expert Edit preset catalog and helpers.
 * Provides stable preset IDs, drag payload encoding, and custom override resolution.
 */
export const EDIT_PRESET_MORE_LABEL = "More presets" as const;
export const EDIT_PRESET_COMPOSITE_GENERATE_LABEL = "Composite & Generate" as const;
export const EDIT_PRESET_PANEL_MAX = 11;
export const EXPERT_EDIT_PRESET_DRAG_MIME = "application/x-shortpulse-expert-edit-preset";
export const EDIT_PRESET_DELETED_OVERRIDE_LABEL = "__shortpulse_preset_deleted__";
export const EDIT_PRESET_DELETED_OVERRIDE_PROMPT = "__shortpulse_preset_deleted__";
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

const EDIT_PRESET_CUSTOM_PROMPT_PLACEHOLDER =
  "Edit this custom preset text to create your own reusable prompt.";

const EDIT_PRESET_CUSTOM_PROMPTS = Array.from(
  { length: 18 },
  () => EDIT_PRESET_CUSTOM_PROMPT_PLACEHOLDER
) as readonly string[];
const EDIT_PRESET_VISIBLE_CUSTOM_COUNT = 3;

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

export type ExpertEditPresetOverride = {
  label: string;
  prompt: string;
};

export type ExpertEditPresetOverrides = Partial<
  Record<ExpertEditPresetId, ExpertEditPresetOverride>
>;

/**
 * Backward-compatible alias kept while callsites migrate from custom-only naming.
 */
export type ExpertEditCustomPresetOverride = ExpertEditPresetOverride;

/**
 * Backward-compatible alias kept while callsites migrate from custom-only naming.
 */
export type ExpertEditCustomPresetOverrides = ExpertEditPresetOverrides;

export type ExpertEditResolvedPreset = {
  presetId: ExpertEditPresetId;
  label: string;
  prompt: string;
  isCustom: boolean;
  hasOverride: boolean;
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

const normalizePresetOverrideLabel = (value: string) => value.trim();
const normalizePresetOverridePrompt = (value: string) => value.trim();
const isDeletedPresetOverride = (override: ExpertEditPresetOverride | null | undefined): boolean =>
  Boolean(
    override &&
    override.label === EDIT_PRESET_DELETED_OVERRIDE_LABEL &&
    override.prompt === EDIT_PRESET_DELETED_OVERRIDE_PROMPT
  );

export const createDeletedPresetOverride = (): ExpertEditPresetOverride => ({
  label: EDIT_PRESET_DELETED_OVERRIDE_LABEL,
  prompt: EDIT_PRESET_DELETED_OVERRIDE_PROMPT,
});

const isPresetVisibleInUi = (
  presetId: ExpertEditPresetId,
  customOverrides?: ExpertEditCustomPresetOverrides | null
): boolean => {
  const override = customOverrides?.[presetId];
  if (isDeletedPresetOverride(override)) return false;
  if (!presetId.startsWith("custom_")) return true;
  const customNumber = Number.parseInt(presetId.slice("custom_".length), 10);
  const isVisibleDefaultCustomPreset =
    Number.isFinite(customNumber) &&
    customNumber >= 1 &&
    customNumber <= EDIT_PRESET_VISIBLE_CUSTOM_COUNT;
  if (isVisibleDefaultCustomPreset) return true;
  return Boolean(override);
};
const resolveVisibleSurfacePresetIds = (
  customOverrides?: ExpertEditCustomPresetOverrides | null
): ExpertEditPresetId[] =>
  EDIT_PRESET_BASE_DEFINITIONS.map((definition) => definition.presetId).filter((presetId) =>
    isPresetVisibleInUi(presetId, customOverrides)
  ) as ExpertEditPresetId[];

/**
 * Ordered canonical list of all Expert Edit preset IDs.
 */
export const EDIT_PRESET_SURFACE_PRESET_IDS = resolveVisibleSurfacePresetIds();

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
export const mapLegacyPresetLabelsToIds = (
  labels: readonly string[],
  customOverrides?: ExpertEditCustomPresetOverrides | null
): ExpertEditPresetId[] => {
  const resolvedPresetIds = labels
    .map((label) => mapLegacyPresetLabelToId(label))
    .filter(
      (presetId): presetId is ExpertEditPresetId =>
        presetId != null && isPresetVisibleInUi(presetId, customOverrides)
    );
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
export const normalizePresetPanelPresetIds = (
  presetIds: readonly string[],
  customOverrides?: ExpertEditCustomPresetOverrides | null
): ExpertEditPresetId[] =>
  sortPresetIdsByCanonicalOrder(presetIds)
    .filter((presetId) => isPresetVisibleInUi(presetId, customOverrides))
    .slice(0, EDIT_PRESET_PANEL_MAX);

/**
 * Legacy helper kept for compatibility in fallback tests/paths.
 */
export const sortPresetLabelsByCanonicalOrder = (
  labels: readonly string[],
  customOverrides?: ExpertEditCustomPresetOverrides | null
) =>
  mapLegacyPresetLabelsToIds(labels, customOverrides).map(
    (presetId) => EDIT_PRESET_BASE_BY_ID.get(presetId)?.label ?? presetId
  );

/**
 * Normalizes preset overrides to known preset IDs with non-empty label/prompt.
 */
export const normalizeExpertEditCustomPresetOverrides = (
  value: unknown
): ExpertEditCustomPresetOverrides => {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value as Record<string, unknown>);
  const normalized: ExpertEditCustomPresetOverrides = {};
  entries.forEach(([rawPresetId, rawOverride]) => {
    if (!isExpertEditPresetId(rawPresetId)) return;
    if (!rawOverride || typeof rawOverride !== "object") return;
    const candidateLabel =
      typeof (rawOverride as { label?: unknown }).label === "string"
        ? normalizePresetOverrideLabel((rawOverride as { label: string }).label)
        : "";
    const candidatePrompt =
      typeof (rawOverride as { prompt?: unknown }).prompt === "string"
        ? normalizePresetOverridePrompt((rawOverride as { prompt: string }).prompt)
        : "";
    if (!candidateLabel || !candidatePrompt) return;
    normalized[rawPresetId as ExpertEditPresetId] = {
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
      hasOverride: false,
    };
  }

  const isCustom = isExpertEditCustomPresetId(presetId);
  const override = customOverrides?.[presetId];
  return {
    presetId,
    label: override?.label ?? baseDefinition.label,
    prompt: override?.prompt ?? baseDefinition.prompt,
    isCustom,
    hasOverride: Boolean(override),
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
  resolveVisibleSurfacePresetIds(customOverrides).map((presetId) =>
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
