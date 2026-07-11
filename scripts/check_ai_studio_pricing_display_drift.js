#!/usr/bin/env node
// Guardrail for AI Studio billable pricing display drift.
// Run with: node scripts/check_ai_studio_pricing_display_drift.js
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const countMatches = (source, pattern) => {
  const matches = source.match(pattern);
  return matches ? matches.length : 0;
};

const fileChecks = [
  {
    file: "frontend/features/ai-studio/logic/clientPricingDisplay.ts",
    label: "shared client pricing resolver",
    requireIncludes: [
      "resolveClientPricingBreakdown",
      "resolveClientBilledCredits",
      "if (!pricingPolicyReady) return null;",
      "resolvePricingGridCostBreakdown({",
      "requirePublishedBillingRule: true",
    ],
    forbidIncludes: ["computeCostForModel("],
  },
  {
    file: "frontend/features/ai-studio/hooks/useAiStudioViewModel.ts",
    label: "AI Studio view-model",
    requireIncludes: [
      "resolveClientBilledCredits",
      "resolveClientPricingBreakdown",
      "resolveVideoBilledCreditLookup",
      "resolveVideoBilledCredits",
      "pricingPolicyReady: !isPricingPolicyUnavailable",
    ],
    forbidIncludes: ["computeCostForModel("],
  },
  {
    file: "frontend/lib/model-runtime/videoBilledCredits.ts",
    label: "canonical video billed-credit resolver",
    requireIncludes: [
      "supportsCanonicalVideoBilledPricing",
      "resolveVideoBilledCreditLookup",
      "resolvePricingGridCostBreakdown({",
    ],
  },
  {
    file: "frontend/features/ai-studio/hooks/useAiStudioCreatePanelRuntime.ts",
    label: "Standard Create runtime",
    requireIncludes: [
      "resolveStandardCreatePrimaryCostCredits",
      'mode === "text"',
      "promptReferenceGenerateCostCredits ?? currentCostCredits",
    ],
    forbidIncludes: ['mode === "text" && !chatModeEnabled'],
  },
  {
    file: "frontend/features/ai-studio/hooks/standardCreateRuntime/useStandardCreatePrimarySubmit.ts",
    label: "Standard Create primary submit",
    requireIncludes: [
      "resolveStandardCreatePrimaryActionDecision",
      "return handleGenerate(decision.prompt, decision.options);",
    ],
  },
  {
    file: "frontend/features/ai-studio/createRuntime/standardPanel/standardCreatePrimaryActionPolicy.ts",
    label: "Standard Create primary action policy",
    requireIncludes: ["costOverrideCredits: createGenerateCostCredits"],
  },
  {
    file: "frontend/features/ai-studio/components/ModelModal.tsx",
    label: "model modal",
    requireIncludes: ['return "—";'],
    forbidIncludes: ["buildDefaultPricingParams(", "computeCostForModel("],
  },
  {
    file: "frontend/features/ai-studio/components/MusicPropertiesPanel.tsx",
    label: "music panel",
    requireIncludes: [
      "resolvePricingGridBilledCredits({",
      "pricingPolicyReady",
      "requirePublishedBillingRule: true",
    ],
    forbidIncludes: ["computeCostForModel("],
  },
  {
    file: "frontend/features/ai-studio/components/SoundEffectsPropertiesPanel.tsx",
    label: "sound effects panel",
    requireIncludes: [
      "resolvePricingGridBilledCredits({",
      "pricingPolicyReady",
      "requirePublishedBillingRule: true",
    ],
    forbidIncludes: ["computeCostForModel("],
  },
  {
    file: "frontend/features/ai-studio/components/VoicesPropertiesPanel.tsx",
    label: "voices panel",
    requireIncludes: [
      "resolvePricingGridBilledCredits({",
      "pricingPolicyReady",
      "requirePublishedBillingRule: true",
    ],
    forbidIncludes: ["computeCostForModel("],
  },
  {
    file: "frontend/features/ai-studio/hooks/useAiStudioAudioGeneration.ts",
    label: "audio submit hook",
    requireIncludes: [
      'pricing_display_source: "pricing_grid"',
      "pricing_policy_ready:",
    ],
  },
  {
    file: "frontend/lib/server/api/generationBilling.ts",
    label: "generation billing canonical pricing path",
    requireIncludes: [
      "billingWorkflow,",
      "isImageBillingWorkflow",
      "shouldResolveCreateImagePricing",
      "selectCanonicalPricingCandidate",
      "resolveVideoBilledCreditLookup",
      "api.generation_billing_missing_canonical_video_price",
      "api.generation_billing_missing_canonical_audio_price",
      "requiresDisplayedPricingEvidence",
    ],
    forbidIncludes: [
      "shortpulseContext.selected_tool",
      "shortpulseContext.mode",
      'workflow === "image"',
    ],
  },
  {
    file: "frontend/pages/api/ai/generate-style-preview.ts",
    label: "style preview billed helper path",
    requireIncludes: [
      'billingWorkflow: "style_preview"',
      'source_mode: "style_preview"',
    ],
  },
  {
    file: "frontend/features/ai-studio/logic/rerollPricingEvidence.ts",
    label: "AI Studio reroll pricing evidence resolver",
    requireIncludes: [
      "resolveRerollPricingEvidence",
      "resolveCreateImageBilledCreditLookup",
      "resolveEditImageBilledCreditLookup",
      "resolveVideoBilledCreditLookup",
    ],
  },
  {
    file: "frontend/features/ai-studio/hooks/useAiStudioRerollController.ts",
    label: "AI Studio reroll pricing evidence forwarding",
    requireIncludes: ["resolvePricingEvidence", "...pricingEvidence"],
  },
  {
    file: "frontend/features/ai-studio/routes/AiStudioRouteApp.tsx",
    label: "AI Studio page wiring",
    requireRegexes: [
      {
        pattern: /pricingPolicyReady:\s*modelPricingPolicyReady/g,
        minimum: 3,
        description:
          "expected pricingPolicyReady to be passed into the three billable audio property panels",
      },
    ],
  },
];

const failures = [];

for (const check of fileChecks) {
  const source = read(check.file);

  for (const snippet of check.requireIncludes || []) {
    if (!source.includes(snippet)) {
      failures.push(
        `${check.file}: missing required ${check.label} marker ${JSON.stringify(snippet)}`,
      );
    }
  }

  for (const snippet of check.forbidIncludes || []) {
    if (source.includes(snippet)) {
      failures.push(
        `${check.file}: found forbidden ${check.label} marker ${JSON.stringify(snippet)}`,
      );
    }
  }

  for (const regexCheck of check.requireRegexes || []) {
    const matches = countMatches(source, regexCheck.pattern);
    if (matches < regexCheck.minimum) {
      failures.push(
        `${check.file}: ${regexCheck.description}; found ${matches}, expected at least ${regexCheck.minimum}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("AI Studio pricing display drift check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("AI Studio pricing display drift check passed.");
