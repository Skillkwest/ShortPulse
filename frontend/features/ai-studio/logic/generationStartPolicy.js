"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveGenerationStartDecision = exports.CREATE_TEXT_MODE_GENERATION_BLOCK_ERROR = exports.GENERATION_GUARDRAIL_FALLBACK_ERROR = exports.GENERATION_MISSING_MODEL_ERROR = exports.GENERATION_MISSING_PROMPT_ERROR = exports.CHARACTER_MODE_MISSING_REFERENCES_ERROR = void 0;
exports.CHARACTER_MODE_MISSING_REFERENCES_ERROR = "Character Mode requires at least one character image before generating.";
exports.GENERATION_MISSING_PROMPT_ERROR = "Add a prompt to start a generation.";
exports.GENERATION_MISSING_MODEL_ERROR = "Pick a model to generate.";
exports.GENERATION_GUARDRAIL_FALLBACK_ERROR = "Generation is currently unavailable. Please review your selections and try again.";
exports.CREATE_TEXT_MODE_GENERATION_BLOCK_ERROR = "Switch to image generation before running this action.";
var isCreatePromptTool = function (tool) { return tool === "create" || tool === "text"; };
var requiresModelSelection = function (tool, mode) {
    if (tool === "video" || tool === "kling" || tool === "image" || tool === "edit")
        return true;
    if (isCreatePromptTool(tool) && mode !== "text")
        return true;
    return false;
};
/**
 * Resolves deterministic allow/block decisions for generation start.
 */
var resolveGenerationStartDecision = function (_a) {
    var tool = _a.tool, mode = _a.mode, modelId = _a.modelId, promptText = _a.promptText, _b = _a.guardrailMessage, guardrailMessage = _b === void 0 ? null : _b, _c = _a.checkCreateTextMode, checkCreateTextMode = _c === void 0 ? true : _c, _d = _a.checkPrompt, checkPrompt = _d === void 0 ? true : _d, _e = _a.checkModel, checkModel = _e === void 0 ? true : _e, _f = _a.checkCharacterReferences, checkCharacterReferences = _f === void 0 ? false : _f, _g = _a.hasCharacterModeReferences, hasCharacterModeReferences = _g === void 0 ? true : _g;
    var trimmedPrompt = typeof promptText === "string" ? promptText.trim() : "";
    var trimmedModelId = typeof modelId === "string" ? modelId.trim() : "";
    var normalizedGuardrailMessage = typeof guardrailMessage === "string" ? guardrailMessage.trim() : "";
    if (normalizedGuardrailMessage.length > 0) {
        return {
            allow: false,
            reason: "guardrail",
            message: normalizedGuardrailMessage,
        };
    }
    if (checkCreateTextMode && isCreatePromptTool(tool) && mode === "text") {
        return {
            allow: false,
            reason: "create_text_mode",
            message: exports.CREATE_TEXT_MODE_GENERATION_BLOCK_ERROR,
        };
    }
    if (checkPrompt && trimmedPrompt.length === 0) {
        return {
            allow: false,
            reason: "missing_prompt",
            message: exports.GENERATION_MISSING_PROMPT_ERROR,
        };
    }
    if (checkModel && requiresModelSelection(tool, mode) && trimmedModelId.length === 0) {
        return {
            allow: false,
            reason: "missing_model",
            message: exports.GENERATION_MISSING_MODEL_ERROR,
        };
    }
    if (checkCharacterReferences && isCreatePromptTool(tool) && !hasCharacterModeReferences) {
        return {
            allow: false,
            reason: "missing_character_references",
            message: exports.CHARACTER_MODE_MISSING_REFERENCES_ERROR,
        };
    }
    return { allow: true };
};
exports.resolveGenerationStartDecision = resolveGenerationStartDecision;
