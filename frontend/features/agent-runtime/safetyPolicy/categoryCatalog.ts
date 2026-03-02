/**
 * Canonical mapping from runtime safety classification to policy category.
 */
import type { SafetyCategoryId, SafetyClassification } from "./types";

export const SAFETY_CATEGORY_CATALOG: Record<
  SafetyCategoryId,
  { id: SafetyCategoryId; hardFloorCandidate: boolean }
> = {
  safe: { id: "safe", hardFloorCandidate: false },
  sexual_suggestive: { id: "sexual_suggestive", hardFloorCandidate: false },
  sexual_explicit: { id: "sexual_explicit", hardFloorCandidate: true },
};

export const mapClassificationToSafetyCategory = (
  classification: SafetyClassification
): SafetyCategoryId => {
  if (classification === "refuse") return "sexual_explicit";
  if (classification === "needs_rewrite") return "sexual_suggestive";
  return "safe";
};
