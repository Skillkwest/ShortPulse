#!/usr/bin/env node
// Guardrail for AI Studio billable pricing display drift.
// Run with: node scripts/check_ai_studio_pricing_display_drift.js
const fs = require("fs");
const path = require("path");

const repoRoot = process.cwd();

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
      "computeCostForModel(modelId, params, pricingPolicy)",
    ],
  },
  {
    file: "frontend/features/ai-studio/hooks/useAiStudioViewModel.ts",
    label: "AI Studio view-model",
    requireIncludes: [
      "resolveClientBilledCredits",
      "resolveClientPricingBreakdown",
      "pricingPolicyReady: !isPricingPolicyUnavailable",
    ],
    forbidIncludes: ["computeCostForModel("],
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
    requireIncludes: ["resolveClientBilledCredits({", "pricingPolicyReady"],
    forbidIncludes: ["computeCostForModel("],
  },
  {
    file: "frontend/features/ai-studio/components/SoundEffectsPropertiesPanel.tsx",
    label: "sound effects panel",
    requireIncludes: ["resolveClientBilledCredits({", "pricingPolicyReady"],
    forbidIncludes: ["computeCostForModel("],
  },
  {
    file: "frontend/features/ai-studio/components/VoicesPropertiesPanel.tsx",
    label: "voices panel",
    requireIncludes: ["resolveClientBilledCredits({", "pricingPolicyReady"],
    forbidIncludes: ["computeCostForModel("],
  },
  {
    file: "frontend/pages/ai-studio.tsx",
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
        `${check.file}: missing required ${check.label} marker ${JSON.stringify(snippet)}`
      );
    }
  }

  for (const snippet of check.forbidIncludes || []) {
    if (source.includes(snippet)) {
      failures.push(
        `${check.file}: found forbidden ${check.label} marker ${JSON.stringify(snippet)}`
      );
    }
  }

  for (const regexCheck of check.requireRegexes || []) {
    const matches = countMatches(source, regexCheck.pattern);
    if (matches < regexCheck.minimum) {
      failures.push(
        `${check.file}: ${regexCheck.description}; found ${matches}, expected at least ${regexCheck.minimum}`
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
