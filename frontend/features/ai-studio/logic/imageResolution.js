"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeNanoBananaProResolution = exports.normalizeNanoBanana2Resolution = exports.normalizeImageResolutionForPricing = exports.isSeedreamAutoImageSize = exports.isModelDefaultImageResolution = exports.clampImageResolutionForModel = exports.getHighestImageResolutionForModel = exports.getImageResolutionOptions = exports.formatImageResolutionLabel = exports.SEEDREAM_AUTO_4K_IMAGE_SIZE = exports.SEEDREAM_AUTO_3K_IMAGE_SIZE = exports.SEEDREAM_AUTO_2K_IMAGE_SIZE = exports.MODEL_DEFAULT_IMAGE_RESOLUTION = void 0;
/**
 * Shared image-resolution helpers for AI Studio image workflows.
 * Keeps per-model option labeling, clamping, and normalization in one place.
 */
var modelRegistry_1 = require("./modelRegistry");
exports.MODEL_DEFAULT_IMAGE_RESOLUTION = "model_default";
exports.SEEDREAM_AUTO_2K_IMAGE_SIZE = "auto_2K";
exports.SEEDREAM_AUTO_3K_IMAGE_SIZE = "auto_3K";
exports.SEEDREAM_AUTO_4K_IMAGE_SIZE = "auto_4K";
var IMAGE_RESOLUTION_LABELS = (_a = {},
    _a[exports.MODEL_DEFAULT_IMAGE_RESOLUTION] = "Model default",
    _a[exports.SEEDREAM_AUTO_2K_IMAGE_SIZE] = "2K",
    _a[exports.SEEDREAM_AUTO_3K_IMAGE_SIZE] = "3K",
    _a[exports.SEEDREAM_AUTO_4K_IMAGE_SIZE] = "4K",
    _a["0.5K"] = "0.5K",
    _a["1K"] = "1K",
    _a["2K"] = "2K",
    _a["4K"] = "4K",
    _a);
var formatImageResolutionLabel = function (value) {
    var _a;
    return (_a = IMAGE_RESOLUTION_LABELS[value]) !== null && _a !== void 0 ? _a : value;
};
exports.formatImageResolutionLabel = formatImageResolutionLabel;
var getImageResolutionOptions = function (modelId) {
    var _a;
    var config = modelId ? (0, modelRegistry_1.getModelConfig)(modelId) : null;
    var values = ((_a = config === null || config === void 0 ? void 0 : config.allowedResolutions) === null || _a === void 0 ? void 0 : _a.length)
        ? config.allowedResolutions
        : [exports.MODEL_DEFAULT_IMAGE_RESOLUTION];
    return values.map(function (value) { return ({ value: value, label: (0, exports.formatImageResolutionLabel)(value) }); });
};
exports.getImageResolutionOptions = getImageResolutionOptions;
var getImageResolutionPriority = function (value) {
    var normalized = value.trim().toLowerCase();
    if (normalized === "auto_4k" || normalized === "4k")
        return 500;
    if (normalized === "auto_3k" || normalized === "3k")
        return 450;
    if (normalized === "auto_2k" || normalized === "2k")
        return 400;
    if (normalized === "1080p")
        return 350;
    if (normalized === "720p")
        return 300;
    if (normalized === "1k")
        return 200;
    if (normalized === "0.5k")
        return 150;
    if (normalized === exports.MODEL_DEFAULT_IMAGE_RESOLUTION)
        return 0;
    var kiloMatch = normalized.match(/^(\d+)k$/);
    if (kiloMatch) {
        var numeric = Number(kiloMatch[1]);
        if (Number.isFinite(numeric)) {
            return 200 + numeric;
        }
    }
    return 100;
};
var getHighestImageResolutionForModel = function (modelId) {
    var options = (0, exports.getImageResolutionOptions)(modelId);
    if (!options.length) {
        return exports.MODEL_DEFAULT_IMAGE_RESOLUTION;
    }
    return options.reduce(function (best, option) {
        if (getImageResolutionPriority(option.value) > getImageResolutionPriority(best.value)) {
            return option;
        }
        return best;
    }).value;
};
exports.getHighestImageResolutionForModel = getHighestImageResolutionForModel;
var clampImageResolutionForModel = function (modelId, value) {
    var config = modelId ? (0, modelRegistry_1.getModelConfig)(modelId) : null;
    var allowed = config === null || config === void 0 ? void 0 : config.allowedResolutions;
    if (!(allowed === null || allowed === void 0 ? void 0 : allowed.length)) {
        return exports.MODEL_DEFAULT_IMAGE_RESOLUTION;
    }
    if (value && allowed.includes(value)) {
        return value;
    }
    if ((config === null || config === void 0 ? void 0 : config.defaultResolution) && allowed.includes(config.defaultResolution)) {
        return config.defaultResolution;
    }
    return allowed[0];
};
exports.clampImageResolutionForModel = clampImageResolutionForModel;
var isModelDefaultImageResolution = function (value) {
    return !value || value === exports.MODEL_DEFAULT_IMAGE_RESOLUTION;
};
exports.isModelDefaultImageResolution = isModelDefaultImageResolution;
var isSeedreamAutoImageSize = function (value) {
    return (value === exports.SEEDREAM_AUTO_2K_IMAGE_SIZE ||
        value === exports.SEEDREAM_AUTO_3K_IMAGE_SIZE ||
        value === exports.SEEDREAM_AUTO_4K_IMAGE_SIZE);
};
exports.isSeedreamAutoImageSize = isSeedreamAutoImageSize;
var normalizeImageResolutionForPricing = function (value) {
    if (!value || (0, exports.isModelDefaultImageResolution)(value))
        return undefined;
    var normalized = value.trim().toLowerCase();
    if (normalized === "auto_4k" || normalized === "4k")
        return "4K";
    if (normalized === "auto_3k" || normalized === "3k")
        return "3K";
    if (normalized === "auto_2k" || normalized === "2k")
        return "2K";
    if (normalized === "0.5k")
        return "0.5K";
    if (normalized === "1k")
        return "1K";
    return value;
};
exports.normalizeImageResolutionForPricing = normalizeImageResolutionForPricing;
var normalizeNanoBanana2Resolution = function (value, fallback) {
    if (fallback === void 0) { fallback = "1K"; }
    if (!value)
        return fallback;
    var normalized = value.trim().toLowerCase();
    if (normalized.includes("4k"))
        return "4K";
    if (normalized.includes("2k"))
        return "2K";
    if (normalized.includes("0.5k") || normalized === "0.5" || normalized === "half")
        return "0.5K";
    if (normalized.includes("1k"))
        return "1K";
    return fallback;
};
exports.normalizeNanoBanana2Resolution = normalizeNanoBanana2Resolution;
var normalizeNanoBananaProResolution = function (value, fallback) {
    if (fallback === void 0) { fallback = "1K"; }
    if (!value)
        return fallback;
    var normalized = value.trim().toLowerCase();
    if (normalized.includes("4k"))
        return "4K";
    if (normalized.includes("2k"))
        return "2K";
    if (normalized.includes("1k"))
        return "1K";
    return fallback;
};
exports.normalizeNanoBananaProResolution = normalizeNanoBananaProResolution;
