"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendStylePromptToSubmission = exports.isStylePromptFamilyAdapterEnabled = exports.resolveStylePromptModelFamily = void 0;
/**
 * AI Studio style prompt adapter logic.
 * Resolves model-family style phrasing for submission prompts while preserving
 * legacy formatting and tool gating semantics.
 */
var pricing_1 = require("./pricing");
var STYLE_PROMPT_ENABLED_TOOLS = new Set(["create", "text", "image", "edit"]);
var NANO_BANANA_STRATEGIES = new Set([
    "google-nano-banana-per-image",
    "nano-banana-per-image",
    "nano-banana-2-per-image",
]);
var SEEDREAM_STRATEGIES = new Set([
    "seedream-per-image",
    "seedream-5-lite-per-image",
]);
var resolveNormalizedStylePrompt = function (value) {
    if (typeof value !== "string")
        return "";
    return value.trim().replace(/\s{2,}/g, " ");
};
var shouldAppendStylePromptForTool = function (tool) {
    if (!tool)
        return false;
    return STYLE_PROMPT_ENABLED_TOOLS.has(tool);
};
var resolveStylePromptLine = function (_a) {
    var modelFamily = _a.modelFamily, normalizedStylePrompt = _a.normalizedStylePrompt, adapterEnabled = _a.adapterEnabled;
    if (!adapterEnabled || modelFamily === "generic") {
        return "Visual style reference: ".concat(normalizedStylePrompt);
    }
    if (modelFamily === "nano_banana") {
        return "Visual style reference (treatment only): ".concat(normalizedStylePrompt, ". Preserve subject identity and base composition.");
    }
    return "Visual style reference: ".concat(normalizedStylePrompt, ". Emphasize cohesive palette, lighting mood, and surface texture.");
};
/**
 * Resolves model-family grouping for style prompt adaptation from pricing strategy.
 */
var resolveStylePromptModelFamily = function (modelId) {
    var _a;
    if (!modelId)
        return "generic";
    var pricingStrategy = (_a = (0, pricing_1.getModelConfig)(modelId)) === null || _a === void 0 ? void 0 : _a.pricingStrategy;
    if (!pricingStrategy)
        return "generic";
    if (NANO_BANANA_STRATEGIES.has(pricingStrategy))
        return "nano_banana";
    if (SEEDREAM_STRATEGIES.has(pricingStrategy))
        return "seedream";
    return "generic";
};
exports.resolveStylePromptModelFamily = resolveStylePromptModelFamily;
/**
 * Returns true when model-family style adaptation is enabled at runtime.
 */
var isStylePromptFamilyAdapterEnabled = function (rawValue) {
    if (rawValue === void 0) { rawValue = process.env.NEXT_PUBLIC_AI_STUDIO_STYLE_FAMILY_ADAPTER_ENABLED; }
    return rawValue !== "false";
};
exports.isStylePromptFamilyAdapterEnabled = isStylePromptFamilyAdapterEnabled;
/**
 * Appends style prompt text using model-family aware phrasing while preserving legacy formatting.
 */
var appendStylePromptToSubmission = function (_a) {
    var tool = _a.tool, submissionPrompt = _a.submissionPrompt, selectedStylePrompt = _a.selectedStylePrompt, modelId = _a.modelId, adapterEnabled = _a.adapterEnabled;
    if (!shouldAppendStylePromptForTool(tool))
        return submissionPrompt;
    var normalizedStylePrompt = resolveNormalizedStylePrompt(selectedStylePrompt);
    if (!normalizedStylePrompt.length)
        return submissionPrompt;
    var modelFamily = (0, exports.resolveStylePromptModelFamily)(modelId);
    var stylePromptLine = resolveStylePromptLine({
        modelFamily: modelFamily,
        normalizedStylePrompt: normalizedStylePrompt,
        adapterEnabled: adapterEnabled,
    });
    return submissionPrompt.trim().length
        ? "".concat(submissionPrompt, "\n\n").concat(stylePromptLine)
        : stylePromptLine;
};
exports.appendStylePromptToSubmission = appendStylePromptToSubmission;
