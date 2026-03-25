"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStagedAgentPrompt = exports.resolvePromptSourceBadge = exports.sanitizeGenerationPromptText = exports.removeAspectRatioLanguage = exports.normalizePromptText = void 0;
/**
 * Prompt ownership helpers for AI Studio agent workflows.
 * Keeps source-of-truth semantics (agent/manual/reference) explicit and testable.
 */
var promptText_1 = require("../../agent-core/promptText");
/**
 * Normalizes an incoming prompt string and returns null for blank values.
 */
var normalizePromptText = function (value) {
    return (0, promptText_1.normalizePromptText)(value);
};
exports.normalizePromptText = normalizePromptText;
/**
 * Removes aspect-ratio language (e.g. 9:16, 16:9) from prompt text.
 */
var removeAspectRatioLanguage = function (value) {
    return (0, promptText_1.removeAspectRatioLanguage)(value);
};
exports.removeAspectRatioLanguage = removeAspectRatioLanguage;
/**
 * Removes metadata-like recap text from model-generated prompts.
 */
var sanitizeGenerationPromptText = function (value) {
    return (0, promptText_1.sanitizeGenerationPromptText)(value);
};
exports.sanitizeGenerationPromptText = sanitizeGenerationPromptText;
/**
 * Returns the source badge shown in the inline prompt status block.
 */
var resolvePromptSourceBadge = function (origin) {
    if (origin === "agent")
        return "agent";
    if (origin === "reference")
        return "reference";
    return "manual";
};
exports.resolvePromptSourceBadge = resolvePromptSourceBadge;
/**
 * Returns the staged prompt preview when agent output is the active source.
 */
var getStagedAgentPrompt = function (origin, latestAgentPrompt) {
    if (origin !== "agent")
        return null;
    return (0, promptText_1.normalizePromptText)(latestAgentPrompt);
};
exports.getStagedAgentPrompt = getStagedAgentPrompt;
