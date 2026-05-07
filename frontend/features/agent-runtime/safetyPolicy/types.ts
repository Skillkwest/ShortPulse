/**
 * Safety policy domain types for modality-aware runtime decisions.
 */

export type SafetyModality = "text" | "image" | "video";

export type SafetyPolicyAction = "allow" | "rewrite" | "refuse";

export type SafetyFamily = "sexual" | "violence" | "self_harm" | "hate";

export type SafetySeverity = "suggestive" | "explicit";

export type SafetyCategoryId =
  | "safe"
  | "sexual_suggestive"
  | "sexual_explicit"
  | "violence_suggestive"
  | "violence_explicit"
  | "self_harm_suggestive"
  | "self_harm_explicit"
  | "hate_suggestive"
  | "hate_explicit";

export type SafetyProfileId = "prod_safe_v1" | "staging_lenient" | "dev_absolute_zero";

export type SafetyEnvironment = "development" | "production";

export type SafetyClassification = SafetyCategoryId;

export type SafetyTextLevel = "allow" | "rewrite" | "refuse";

export type SafetyGenerationLevel = "off" | "moderate" | "strict";

export type SafetyPostprocessMode = "enforce" | "off";

export type ModalitySafetyProfile = Record<
  SafetyModality,
  Record<SafetyCategoryId, SafetyPolicyAction>
>;

export type SafetyDecision = {
  action: SafetyPolicyAction;
  source: "profile" | "hard_floor" | "absolute_zero";
  profileId: SafetyProfileId;
  category: SafetyCategoryId;
  modality: SafetyModality;
};

export type SafetyPolicyDocumentV2 = {
  schemaVersion: 2;
  input: {
    text: Record<
      SafetyModality,
      Record<
        SafetyFamily,
        {
          level: SafetyTextLevel;
          suggestiveAction?: SafetyPolicyAction;
          explicitAction?: SafetyPolicyAction;
        }
      >
    >;
    image_preflight: {
      enabled: boolean;
      thresholds: Record<SafetyFamily, number>;
    };
  };
  generation: {
    defaults: Record<
      Exclude<SafetyModality, "text">,
      {
        level: SafetyGenerationLevel;
      }
    >;
    per_model: Record<
      string,
      {
        level?: SafetyGenerationLevel;
        enableSafetyChecker?: boolean;
        safetyTolerance?: 1 | 2 | 3 | 4 | 5;
      }
    >;
  };
  postprocess: {
    mode: SafetyPostprocessMode;
  };
};
