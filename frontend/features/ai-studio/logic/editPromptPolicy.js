"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldCheckPromptAtGenerationStart = exports.shouldRequirePromptForEditModel = exports.resolveEditPromptRequirement = exports.BRIA_BACKGROUND_REMOVE_MODEL_ID = void 0;
exports.BRIA_BACKGROUND_REMOVE_MODEL_ID = "fal-ai/bria/background/remove";
var REQUIRED_EDIT_PROMPT_MODEL_IDS = new Set([
    "fal/flux-2/edit",
    "fal-ai/flux-2/edit",
    "fal/flux-2-pro/edit",
    "fal-ai/flux-2-pro/edit",
    "fal-ai/nano-banana/edit",
    "fal-ai/nano-banana-2/edit",
    "fal-ai/nano-banana-pro/edit",
    "fal-ai/bytedance/seedream/v4.5/edit",
    "fal-ai/bytedance/seedream/v5/lite/edit",
]);
var OPTIONAL_EDIT_PROMPT_MODEL_IDS = new Set([exports.BRIA_BACKGROUND_REMOVE_MODEL_ID]);
var normalizeModelId = function (modelId) {
    return typeof modelId === "string" ? modelId.trim().toLowerCase() : "";
};
var resolveEditPromptRequirement = function (modelId) {
    var normalizedModelId = normalizeModelId(modelId);
    if (!normalizedModelId)
        return "unknown";
    if (OPTIONAL_EDIT_PROMPT_MODEL_IDS.has(normalizedModelId))
        return "optional";
    if (REQUIRED_EDIT_PROMPT_MODEL_IDS.has(normalizedModelId))
        return "required";
    return "unknown";
};
exports.resolveEditPromptRequirement = resolveEditPromptRequirement;
var shouldRequirePromptForEditModel = function (modelId) {
    var requirement = (0, exports.resolveEditPromptRequirement)(modelId);
    return requirement !== "optional";
};
exports.shouldRequirePromptForEditModel = shouldRequirePromptForEditModel;
var shouldCheckPromptAtGenerationStart = function (_a) {
    var tool = _a.tool, modelId = _a.modelId;
    if (tool === "edit" || tool === "image") {
        return (0, exports.shouldRequirePromptForEditModel)(modelId);
    }
    return true;
};
exports.shouldCheckPromptAtGenerationStart = shouldCheckPromptAtGenerationStart;
