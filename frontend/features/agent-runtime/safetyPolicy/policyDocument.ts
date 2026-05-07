/**
 * Normalizes control-plane safety policy documents and provides policy-level lookups.
 */
import type {
  SafetyPolicyAction,
  SafetyFamily,
  SafetyGenerationLevel,
  SafetyModality,
  SafetyPolicyDocumentV2,
  SafetyPostprocessMode,
  SafetyProfileId,
  SafetySeverity,
  SafetyTextLevel,
} from "./types";

const SAFETY_FAMILIES: SafetyFamily[] = ["sexual", "violence", "self_harm", "hate"];
const SAFETY_MODALITIES: SafetyModality[] = ["text", "image", "video"];
const GENERATION_MODALITIES: Array<Exclude<SafetyModality, "text">> = ["image", "video"];
const TEXT_LEVELS: SafetyTextLevel[] = ["allow", "rewrite", "refuse"];
const GENERATION_LEVELS: SafetyGenerationLevel[] = ["off", "moderate", "strict"];
const POSTPROCESS_MODES: SafetyPostprocessMode[] = ["enforce", "off"];

const DEFAULT_IMAGE_PREFLIGHT_THRESHOLDS: Record<SafetyFamily, number> = {
  sexual: 0.75,
  violence: 0.8,
  self_harm: 0.8,
  hate: 0.8,
};

const asObjectRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asTextLevel = (value: unknown): SafetyTextLevel | null =>
  typeof value === "string" && TEXT_LEVELS.includes(value as SafetyTextLevel)
    ? (value as SafetyTextLevel)
    : null;

const asPolicyAction = (value: unknown): SafetyPolicyAction | null =>
  value === "allow" || value === "rewrite" || value === "refuse" ? value : null;

const asGenerationLevel = (value: unknown): SafetyGenerationLevel | null =>
  typeof value === "string" && GENERATION_LEVELS.includes(value as SafetyGenerationLevel)
    ? (value as SafetyGenerationLevel)
    : null;

const asPostprocessMode = (value: unknown): SafetyPostprocessMode | null =>
  typeof value === "string" && POSTPROCESS_MODES.includes(value as SafetyPostprocessMode)
    ? (value as SafetyPostprocessMode)
    : null;

const asNumberInRange = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 1) return null;
  return value;
};

const resolveDefaultTextLevelByProfile = (
  profileId: SafetyProfileId
): Record<SafetyFamily, SafetyTextLevel> => {
  if (profileId === "dev_absolute_zero") {
    return {
      sexual: "allow",
      violence: "allow",
      self_harm: "allow",
      hate: "allow",
    };
  }
  if (profileId === "staging_lenient") {
    return {
      sexual: "rewrite",
      violence: "rewrite",
      self_harm: "rewrite",
      hate: "rewrite",
    };
  }
  return {
    sexual: "refuse",
    violence: "refuse",
    self_harm: "refuse",
    hate: "refuse",
  };
};

const buildDefaultPolicyDocument = (profileId: SafetyProfileId): SafetyPolicyDocumentV2 => {
  const levelByFamily = resolveDefaultTextLevelByProfile(profileId);
  const defaultGenerationLevel: SafetyGenerationLevel =
    profileId === "dev_absolute_zero" ? "off" : "moderate";
  return {
    schemaVersion: 2,
    input: {
      text: {
        text: {
          sexual: { level: levelByFamily.sexual },
          violence: { level: levelByFamily.violence },
          self_harm: { level: levelByFamily.self_harm },
          hate: { level: levelByFamily.hate },
        },
        image: {
          sexual: { level: levelByFamily.sexual },
          violence: { level: levelByFamily.violence },
          self_harm: { level: levelByFamily.self_harm },
          hate: { level: levelByFamily.hate },
        },
        video: {
          sexual: { level: levelByFamily.sexual },
          violence: { level: levelByFamily.violence },
          self_harm: { level: levelByFamily.self_harm },
          hate: { level: levelByFamily.hate },
        },
      },
      image_preflight: {
        enabled: true,
        thresholds: DEFAULT_IMAGE_PREFLIGHT_THRESHOLDS,
      },
    },
    generation: {
      defaults: {
        image: { level: defaultGenerationLevel },
        video: { level: defaultGenerationLevel },
      },
      per_model: {},
    },
    postprocess: {
      mode: "enforce",
    },
  };
};

const buildLegacyPolicyDocument = ({
  activePolicy,
  fallback,
}: {
  activePolicy: Record<string, unknown> | null;
  fallback: SafetyPolicyDocumentV2;
}): SafetyPolicyDocumentV2 => {
  if (!activePolicy) return fallback;
  const next = structuredClone(fallback);
  for (const modality of SAFETY_MODALITIES) {
    const modalityPolicy = asObjectRecord(activePolicy[modality]);
    if (!modalityPolicy) continue;
    const suggestiveAction = modalityPolicy.sexual_suggestive;
    const explicitAction = modalityPolicy.sexual_explicit;
    if (explicitAction === "refuse") {
      next.input.text[modality].sexual.level = "refuse";
      continue;
    }
    if (suggestiveAction === "rewrite" || explicitAction === "rewrite") {
      next.input.text[modality].sexual.level = "rewrite";
      continue;
    }
    if (suggestiveAction === "allow" && explicitAction === "allow") {
      next.input.text[modality].sexual.level = "allow";
    }
  }
  return next;
};

const normalizePolicyDocumentV2 = ({
  raw,
  fallback,
}: {
  raw: Record<string, unknown>;
  fallback: SafetyPolicyDocumentV2;
}): SafetyPolicyDocumentV2 => {
  const next = structuredClone(fallback);
  const input = asObjectRecord(raw.input);
  const text = asObjectRecord(input?.text);
  for (const modality of SAFETY_MODALITIES) {
    const modalityBlock = asObjectRecord(text?.[modality]);
    for (const family of SAFETY_FAMILIES) {
      const familyBlock = asObjectRecord(modalityBlock?.[family]);
      const level = asTextLevel(familyBlock?.level);
      if (level) {
        next.input.text[modality][family].level = level;
      }
      const suggestiveAction = asPolicyAction(familyBlock?.suggestiveAction);
      if (suggestiveAction) {
        next.input.text[modality][family].suggestiveAction = suggestiveAction;
      }
      const explicitAction = asPolicyAction(familyBlock?.explicitAction);
      if (explicitAction) {
        next.input.text[modality][family].explicitAction = explicitAction;
      }
    }
  }

  const imagePreflight = asObjectRecord(input?.image_preflight);
  if (typeof imagePreflight?.enabled === "boolean") {
    next.input.image_preflight.enabled = imagePreflight.enabled;
  }
  const thresholds = asObjectRecord(imagePreflight?.thresholds);
  for (const family of SAFETY_FAMILIES) {
    const threshold = asNumberInRange(thresholds?.[family]);
    if (typeof threshold === "number") {
      next.input.image_preflight.thresholds[family] = threshold;
    }
  }

  const generation = asObjectRecord(raw.generation);
  const defaults = asObjectRecord(generation?.defaults);
  for (const modality of GENERATION_MODALITIES) {
    const modalityBlock = asObjectRecord(defaults?.[modality]);
    const level = asGenerationLevel(modalityBlock?.level);
    if (level) {
      next.generation.defaults[modality].level = level;
    }
  }
  const perModel = asObjectRecord(generation?.per_model);
  if (perModel) {
    const normalizedPerModel: SafetyPolicyDocumentV2["generation"]["per_model"] = {};
    for (const [modelId, modelRaw] of Object.entries(perModel)) {
      const modelBlock = asObjectRecord(modelRaw);
      if (!modelBlock) continue;
      const level = asGenerationLevel(modelBlock.level);
      const enableSafetyChecker =
        typeof modelBlock.enableSafetyChecker === "boolean" ? modelBlock.enableSafetyChecker : null;
      const safetyTolerance =
        typeof modelBlock.safetyTolerance === "number" &&
        Number.isFinite(modelBlock.safetyTolerance) &&
        modelBlock.safetyTolerance >= 1 &&
        modelBlock.safetyTolerance <= 5
          ? (Math.floor(modelBlock.safetyTolerance) as 1 | 2 | 3 | 4 | 5)
          : null;
      if (!level && enableSafetyChecker === null && safetyTolerance === null) continue;
      normalizedPerModel[modelId] = {
        ...(level ? { level } : {}),
        ...(enableSafetyChecker !== null ? { enableSafetyChecker } : {}),
        ...(safetyTolerance !== null ? { safetyTolerance } : {}),
      };
    }
    next.generation.per_model = normalizedPerModel;
  }

  const postprocess = asObjectRecord(raw.postprocess);
  const rawMode =
    typeof postprocess?.mode === "string" ? postprocess.mode.trim().toLowerCase() : null;
  const mode = asPostprocessMode(rawMode);
  if (mode) {
    next.postprocess.mode = mode;
  }

  return next;
};

export const resolveSafetyPolicyDocument = ({
  activePolicy,
  profileId,
}: {
  activePolicy?: Record<string, unknown> | null;
  profileId: SafetyProfileId;
}): SafetyPolicyDocumentV2 => {
  const fallback = buildDefaultPolicyDocument(profileId);
  const raw = asObjectRecord(activePolicy);
  if (!raw) return fallback;
  const schemaVersion = raw.schemaVersion;
  if (schemaVersion === 2) {
    return normalizePolicyDocumentV2({ raw, fallback });
  }
  return buildLegacyPolicyDocument({ activePolicy: raw, fallback });
};

export const validateSafetyPolicyDocument = (
  value: unknown
): { ok: true; policy: SafetyPolicyDocumentV2 } | { ok: false; errors: string[] } => {
  const raw = asObjectRecord(value);
  if (!raw) {
    return { ok: false, errors: ["policy must be an object"] };
  }
  if (raw.schemaVersion !== 2) {
    return { ok: false, errors: ["schemaVersion must be 2"] };
  }

  const postprocess = asObjectRecord(raw.postprocess);
  const rawPostprocessMode =
    typeof postprocess?.mode === "string" ? postprocess.mode.trim().toLowerCase() : null;
  if (
    rawPostprocessMode &&
    !POSTPROCESS_MODES.includes(rawPostprocessMode as SafetyPostprocessMode)
  ) {
    return {
      ok: false,
      errors: [`postprocess.mode must be one of: ${POSTPROCESS_MODES.join(", ")}`],
    };
  }

  const normalized = normalizePolicyDocumentV2({
    raw,
    fallback: buildDefaultPolicyDocument("prod_safe_v1"),
  });
  return { ok: true, policy: normalized };
};

export const resolvePolicyTextLevel = ({
  policy,
  modality,
  family,
}: {
  policy: SafetyPolicyDocumentV2;
  modality: SafetyModality;
  family: SafetyFamily;
}): SafetyTextLevel => policy.input.text[modality][family].level;

const mapLevelToAction = ({
  level,
  severity,
}: {
  level: SafetyTextLevel;
  severity: SafetySeverity;
}): SafetyPolicyAction => {
  if (level === "allow") return "allow";
  if (level === "rewrite") return "rewrite";
  return severity === "explicit" ? "refuse" : "rewrite";
};

export const resolvePolicyTextAction = ({
  policy,
  modality,
  family,
  severity,
}: {
  policy: SafetyPolicyDocumentV2;
  modality: SafetyModality;
  family: SafetyFamily;
  severity: SafetySeverity;
}): SafetyPolicyAction => {
  const familyPolicy = policy.input.text[modality][family];
  if (severity === "explicit" && familyPolicy.explicitAction) {
    return familyPolicy.explicitAction;
  }
  if (severity === "suggestive" && familyPolicy.suggestiveAction) {
    return familyPolicy.suggestiveAction;
  }
  return mapLevelToAction({
    level: familyPolicy.level,
    severity,
  });
};

export const resolvePolicyImagePreflightThresholds = (
  policy: SafetyPolicyDocumentV2
): Record<SafetyFamily, number> => policy.input.image_preflight.thresholds;

export const resolvePolicyGenerationLevel = ({
  policy,
  modality,
  modelId,
}: {
  policy: SafetyPolicyDocumentV2;
  modality: Exclude<SafetyModality, "text">;
  modelId: string;
}): SafetyGenerationLevel =>
  policy.generation.per_model[modelId]?.level ?? policy.generation.defaults[modality].level;

export const resolvePolicyGenerationOverride = ({
  policy,
  modelId,
}: {
  policy: SafetyPolicyDocumentV2;
  modelId: string;
}):
  | {
      enableSafetyChecker?: boolean;
      safetyTolerance?: 1 | 2 | 3 | 4 | 5;
    }
  | undefined => {
  const override = policy.generation.per_model[modelId];
  if (!override) return undefined;
  return {
    ...(typeof override.enableSafetyChecker === "boolean"
      ? { enableSafetyChecker: override.enableSafetyChecker }
      : {}),
    ...(typeof override.safetyTolerance === "number"
      ? { safetyTolerance: override.safetyTolerance }
      : {}),
  };
};
