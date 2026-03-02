/**
 * Local image preflight classifier (URL-signal heuristic) used before vision-provider calls.
 */
import { resolvePolicyImagePreflightThresholds, resolvePolicyTextLevel } from "./policyDocument";
import type { SafetyEnvironment, SafetyPolicyDocumentV2 } from "./types";

const DEFAULT_TIMEOUT_MS = 1200;

type ImageFamilyScore = {
  sexual: number;
  violence: number;
  self_harm: number;
  hate: number;
};

export type ImagePreflightResult = {
  outcome: "pass" | "refusal";
  classifierUnavailable: boolean;
  providerCallSkipped: boolean;
  matchedFamily: "sexual" | "violence" | "self_harm" | "hate" | null;
  matchedAction: "allow" | "rewrite" | "refuse" | null;
  scores: ImageFamilyScore;
};

const zeroScores = (): ImageFamilyScore => ({
  sexual: 0,
  violence: 0,
  self_harm: 0,
  hate: 0,
});

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  await new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error("image_preflight_timeout")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });

const scoreFromUrlSignals = async (imageUrl: string): Promise<ImageFamilyScore> => {
  const lower = imageUrl.toLowerCase();
  if (lower.includes("simulate_preflight_unavailable")) {
    throw new Error("preflight_classifier_unavailable");
  }
  const scores = zeroScores();
  if (/\b(?:nsfw|nude|naked|topless|porn|erotic|explicit-sex|adult-content)\b/.test(lower)) {
    scores.sexual = 0.95;
  } else if (/\b(?:sexy|lingerie|sensual|suggestive)\b/.test(lower)) {
    scores.sexual = 0.75;
  }

  if (/\b(?:gore|beheading|dismember|execution|massacre|graphic-violence)\b/.test(lower)) {
    scores.violence = 0.95;
  } else if (/\b(?:blood|weapon|gun|knife|fight|violence)\b/.test(lower)) {
    scores.violence = 0.75;
  }

  if (/\b(?:suicide|self-harm|selfharm|self-injury|overdose|hanging)\b/.test(lower)) {
    scores.self_harm = 0.95;
  } else if (/\b(?:depressed|hurt-myself|end-my-life)\b/.test(lower)) {
    scores.self_harm = 0.75;
  }

  if (/\b(?:hate-crime|ethnic-cleansing|genocide|racial-slur|neo-nazi)\b/.test(lower)) {
    scores.hate = 0.95;
  } else if (/\b(?:racist|bigotry|hate-speech|xenophobia)\b/.test(lower)) {
    scores.hate = 0.75;
  }
  return scores;
};

const resolveFailClosedOnUnavailable = ({
  environment,
  failMode,
}: {
  environment: SafetyEnvironment;
  failMode: "prod_closed_nonprod_open" | "always_closed" | "always_open";
}): boolean => {
  if (failMode === "always_closed") return true;
  if (failMode === "always_open") return false;
  return environment === "production";
};

export const resolveImagePreflightFailMode = (
  rawMode?: string | null
): "prod_closed_nonprod_open" | "always_closed" | "always_open" => {
  const normalized = String(rawMode ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "always_closed") return "always_closed";
  if (normalized === "always_open") return "always_open";
  return "prod_closed_nonprod_open";
};

export const runImageSafetyPreflight = async ({
  enabled,
  imageUrl,
  policyDocument,
  environment,
  failMode,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  enabled: boolean;
  imageUrl: string;
  policyDocument: SafetyPolicyDocumentV2;
  environment: SafetyEnvironment;
  failMode: "prod_closed_nonprod_open" | "always_closed" | "always_open";
  timeoutMs?: number;
}): Promise<ImagePreflightResult> => {
  if (!enabled) {
    return {
      outcome: "pass",
      classifierUnavailable: false,
      providerCallSkipped: false,
      matchedFamily: null,
      matchedAction: null,
      scores: zeroScores(),
    };
  }

  let scores: ImageFamilyScore;
  try {
    scores = await withTimeout(scoreFromUrlSignals(imageUrl), timeoutMs);
  } catch {
    const failClosed = resolveFailClosedOnUnavailable({
      environment,
      failMode,
    });
    return {
      outcome: failClosed ? "refusal" : "pass",
      classifierUnavailable: true,
      providerCallSkipped: failClosed,
      matchedFamily: null,
      matchedAction: null,
      scores: zeroScores(),
    };
  }

  const thresholds = resolvePolicyImagePreflightThresholds(policyDocument);
  for (const family of ["sexual", "violence", "self_harm", "hate"] as const) {
    const score = scores[family];
    if (score < thresholds[family]) continue;
    const level = resolvePolicyTextLevel({
      policy: policyDocument,
      modality: "image",
      family,
    });
    const matchedAction = level === "allow" ? "allow" : level === "rewrite" ? "rewrite" : "refuse";
    if (matchedAction === "allow") continue;
    // Images cannot be text-rewritten before provider call; rewrite behaves as preflight refusal.
    return {
      outcome: "refusal",
      classifierUnavailable: false,
      providerCallSkipped: true,
      matchedFamily: family,
      matchedAction,
      scores,
    };
  }

  return {
    outcome: "pass",
    classifierUnavailable: false,
    providerCallSkipped: false,
    matchedFamily: null,
    matchedAction: null,
    scores,
  };
};
