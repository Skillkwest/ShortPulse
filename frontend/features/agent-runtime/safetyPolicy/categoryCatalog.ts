/**
 * Canonical mapping from runtime safety classification to policy category.
 */
import type { SafetyCategoryId, SafetyClassification, SafetyFamily, SafetySeverity } from "./types";

export const SAFETY_CATEGORY_CATALOG: Record<
  SafetyCategoryId,
  {
    id: SafetyCategoryId;
    family: SafetyFamily | null;
    severity: SafetySeverity | null;
    hardFloorCandidate: boolean;
  }
> = {
  safe: { id: "safe", family: null, severity: null, hardFloorCandidate: false },
  sexual_suggestive: {
    id: "sexual_suggestive",
    family: "sexual",
    severity: "suggestive",
    hardFloorCandidate: false,
  },
  sexual_explicit: {
    id: "sexual_explicit",
    family: "sexual",
    severity: "explicit",
    hardFloorCandidate: true,
  },
  violence_suggestive: {
    id: "violence_suggestive",
    family: "violence",
    severity: "suggestive",
    hardFloorCandidate: false,
  },
  violence_explicit: {
    id: "violence_explicit",
    family: "violence",
    severity: "explicit",
    hardFloorCandidate: false,
  },
  self_harm_suggestive: {
    id: "self_harm_suggestive",
    family: "self_harm",
    severity: "suggestive",
    hardFloorCandidate: false,
  },
  self_harm_explicit: {
    id: "self_harm_explicit",
    family: "self_harm",
    severity: "explicit",
    hardFloorCandidate: false,
  },
  hate_suggestive: {
    id: "hate_suggestive",
    family: "hate",
    severity: "suggestive",
    hardFloorCandidate: false,
  },
  hate_explicit: {
    id: "hate_explicit",
    family: "hate",
    severity: "explicit",
    hardFloorCandidate: false,
  },
};

export const mapClassificationToSafetyCategory = (
  classification: SafetyClassification
): SafetyCategoryId => classification;
