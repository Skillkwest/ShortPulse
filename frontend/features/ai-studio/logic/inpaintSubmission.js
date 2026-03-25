"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEditGenerationModeToggleEnabled = exports.isMarkupStrokeSecondaryReferenceEnabled = exports.isMarkupCollapsedOpenModalEnabled = exports.isMarkupModelLockEnabled = exports.EDIT_GENERATION_MODE_TOGGLE_ENV_KEY = exports.MARKUP_STROKE_SECONDARY_REFERENCE_ENV_KEY = exports.MARKUP_COLLAPSED_OPEN_MODAL_ENV_KEY = exports.MARKUP_MODEL_LOCK_ENV_KEY = exports.MARKUP_NANO_BANANA_PRO_EDIT_MODEL_LABEL = exports.MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID = exports.INPAINT_FLUX_FILL_MODEL_LABEL = exports.INPAINT_FLUX_FILL_MODEL_ID = void 0;
/**
 * Inpaint submission override contract propagated from Expert Edit UI to submit handlers.
 */
exports.INPAINT_FLUX_FILL_MODEL_ID = "fal-ai/flux-pro/v1/fill";
exports.INPAINT_FLUX_FILL_MODEL_LABEL = "Pulse Fill v1";
exports.MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID = "fal-ai/nano-banana-pro/edit";
exports.MARKUP_NANO_BANANA_PRO_EDIT_MODEL_LABEL = "Pulse Markup v1";
exports.MARKUP_MODEL_LOCK_ENV_KEY = "NEXT_PUBLIC_AI_STUDIO_MARKUP_MODEL_LOCK_ENABLED";
exports.MARKUP_COLLAPSED_OPEN_MODAL_ENV_KEY = "NEXT_PUBLIC_AI_STUDIO_MARKUP_COLLAPSED_OPEN_MODAL_ENABLED";
exports.MARKUP_STROKE_SECONDARY_REFERENCE_ENV_KEY = "NEXT_PUBLIC_AI_STUDIO_MARKUP_STROKE_SECONDARY_REFERENCE_ENABLED";
exports.EDIT_GENERATION_MODE_TOGGLE_ENV_KEY = "NEXT_PUBLIC_AI_STUDIO_EDIT_GENERATION_MODE_TOGGLE_ENABLED";
var isMarkupModelLockEnabled = function (rawValue) {
    if (rawValue === void 0) { rawValue = process.env[exports.MARKUP_MODEL_LOCK_ENV_KEY]; }
    return rawValue === "true";
};
exports.isMarkupModelLockEnabled = isMarkupModelLockEnabled;
var isMarkupCollapsedOpenModalEnabled = function (rawValue) {
    if (rawValue === void 0) { rawValue = process.env[exports.MARKUP_COLLAPSED_OPEN_MODAL_ENV_KEY]; }
    return rawValue === "true";
};
exports.isMarkupCollapsedOpenModalEnabled = isMarkupCollapsedOpenModalEnabled;
var isMarkupStrokeSecondaryReferenceEnabled = function (rawValue) {
    if (rawValue === void 0) { rawValue = process.env[exports.MARKUP_STROKE_SECONDARY_REFERENCE_ENV_KEY]; }
    return rawValue === "true";
};
exports.isMarkupStrokeSecondaryReferenceEnabled = isMarkupStrokeSecondaryReferenceEnabled;
var isEditGenerationModeToggleEnabled = function (rawValue) {
    if (rawValue === void 0) { rawValue = process.env[exports.EDIT_GENERATION_MODE_TOGGLE_ENV_KEY]; }
    return rawValue === "true";
};
exports.isEditGenerationModeToggleEnabled = isEditGenerationModeToggleEnabled;
