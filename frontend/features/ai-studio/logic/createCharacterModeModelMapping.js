"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCreateCharacterModeSubmitModel = exports.mapCreateModelOnCharacterModeToggle = exports.getCreateCharacterModeAllowedModels = exports.isCreateCharacterModeModel = exports.CREATE_CHARACTER_MODE_ALLOWED_MODEL_IDS = exports.CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID = exports.CREATE_DEFAULT_MODEL_ID = void 0;
/**
 * Create workflow model pairing/mapping for Character Mode transitions.
 * Keeps Create model remap behavior centralized and deterministic.
 */
exports.CREATE_DEFAULT_MODEL_ID = "fal-ai/bytedance/seedream/v4.5/text-to-image";
exports.CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID = "fal-ai/bytedance/seedream/v4.5/edit";
exports.CREATE_CHARACTER_MODE_ALLOWED_MODEL_IDS = [
    exports.CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID,
    "fal-ai/bytedance/seedream/v5/lite/edit",
    "fal-ai/nano-banana-2/edit",
    "fal-ai/nano-banana-pro/edit",
];
var CREATE_CHARACTER_MODE_ALLOWED_MODEL_ID_SET = new Set(exports.CREATE_CHARACTER_MODE_ALLOWED_MODEL_IDS);
var CREATE_MODEL_PAIRS = [
    {
        textToImageModelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        imageToImageModelId: "fal-ai/bytedance/seedream/v4.5/edit",
    },
    {
        textToImageModelId: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
        imageToImageModelId: "fal-ai/bytedance/seedream/v5/lite/edit",
    },
    {
        textToImageModelId: "fal-ai/nano-banana-2",
        imageToImageModelId: "fal-ai/nano-banana-2/edit",
    },
    {
        textToImageModelId: "fal-ai/nano-banana-pro",
        imageToImageModelId: "fal-ai/nano-banana-pro/edit",
    },
];
var TEXT_TO_EDIT_MODEL_MAP = new Map(CREATE_MODEL_PAIRS.map(function (pair) { return [pair.textToImageModelId, pair.imageToImageModelId]; }));
var EDIT_TO_TEXT_MODEL_MAP = new Map(CREATE_MODEL_PAIRS.map(function (pair) { return [pair.imageToImageModelId, pair.textToImageModelId]; }));
/**
 * Returns `true` when a model is one of the Create Character Mode image-to-image models.
 */
var isCreateCharacterModeModel = function (modelId) {
    if (!modelId)
        return false;
    return CREATE_CHARACTER_MODE_ALLOWED_MODEL_ID_SET.has(modelId);
};
exports.isCreateCharacterModeModel = isCreateCharacterModeModel;
/**
 * Returns the allowed Create models while Character Mode is enabled.
 */
var getCreateCharacterModeAllowedModels = function () {
    return exports.CREATE_CHARACTER_MODE_ALLOWED_MODEL_IDS;
};
exports.getCreateCharacterModeAllowedModels = getCreateCharacterModeAllowedModels;
/**
 * Maps the current Create model when Character Mode toggles ON/OFF.
 */
var mapCreateModelOnCharacterModeToggle = function (_a) {
    var _b, _c;
    var currentModelId = _a.currentModelId, isCharacterModeEnabled = _a.isCharacterModeEnabled;
    if (isCharacterModeEnabled) {
        if (currentModelId && TEXT_TO_EDIT_MODEL_MAP.has(currentModelId)) {
            return (_b = TEXT_TO_EDIT_MODEL_MAP.get(currentModelId)) !== null && _b !== void 0 ? _b : exports.CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID;
        }
        if (currentModelId && (0, exports.isCreateCharacterModeModel)(currentModelId)) {
            return currentModelId;
        }
        return exports.CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID;
    }
    if (currentModelId && EDIT_TO_TEXT_MODEL_MAP.has(currentModelId)) {
        return (_c = EDIT_TO_TEXT_MODEL_MAP.get(currentModelId)) !== null && _c !== void 0 ? _c : exports.CREATE_DEFAULT_MODEL_ID;
    }
    if (currentModelId && TEXT_TO_EDIT_MODEL_MAP.has(currentModelId)) {
        return currentModelId;
    }
    return exports.CREATE_DEFAULT_MODEL_ID;
};
exports.mapCreateModelOnCharacterModeToggle = mapCreateModelOnCharacterModeToggle;
/**
 * Resolves the effective Create submit model for Character Mode safety.
 * ON: coerces text-to-image models to paired edit models.
 * OFF: leaves selected model unchanged.
 */
var resolveCreateCharacterModeSubmitModel = function (_a) {
    var _b;
    var currentModelId = _a.currentModelId, isCharacterModeEnabled = _a.isCharacterModeEnabled;
    if (!isCharacterModeEnabled)
        return currentModelId;
    if (!currentModelId)
        return exports.CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID;
    if ((0, exports.isCreateCharacterModeModel)(currentModelId))
        return currentModelId;
    return (_b = TEXT_TO_EDIT_MODEL_MAP.get(currentModelId)) !== null && _b !== void 0 ? _b : exports.CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID;
};
exports.resolveCreateCharacterModeSubmitModel = resolveCreateCharacterModeSubmitModel;
