"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pricingStrategies = exports.DEFAULT_KLING_DURATION_SECONDS = void 0;
/**
 * Pricing strategy implementations for AI Studio cost estimation.
 */
var modelRegistry_1 = require("./modelRegistry");
var modelSizes_1 = require("./modelSizes");
var pricingCredits_1 = require("./pricingCredits");
var providerModelIds_1 = require("./providerModelIds");
var FAL_COST_PER_MP_USD = 0.025;
var FLUX2_COST_PER_MP_USD = 0.012;
var FLUX2_KLEIN_COST_PER_MP_USD = 0.006;
var FLUX2_EDIT_INPUT_MP = 1;
var FLUX2_PRO_FIRST_MP_USD = 0.03;
var FLUX2_PRO_ADDITIONAL_MP_USD = 0.015;
var FLUX2_PRO_EDIT_NORMALIZED_INPUT_MP = 1;
var FLUX_PRO_FILL_COST_PER_MP_USD = 0.05;
var BRIA_BACKGROUND_REMOVE_PER_IMAGE_USD = 0.018;
var GOOGLE_NANO_BANANA_PER_IMAGE_USD = 0.039;
var GPT_IMAGE_PER_IMAGE_USD = 0.04;
exports.DEFAULT_KLING_DURATION_SECONDS = 10;
var VEO_AUDIO_RATE_1080P_USD_PER_SECOND = 0.4;
var VEO_NO_AUDIO_RATE_1080P_USD_PER_SECOND = 0.2;
var VEO_AUDIO_RATE_4K_USD_PER_SECOND = 0.6;
var VEO_NO_AUDIO_RATE_4K_USD_PER_SECOND = 0.4;
var KLING_3_FAL_RATE_AUDIO_OFF_USD_PER_SECOND = 0.112;
var KLING_3_FAL_RATE_AUDIO_ON_USD_PER_SECOND = 0.168;
var KLING_3_FAL_RATE_AUDIO_VOICE_USD_PER_SECOND = 0.196;
var KLING_3_KIE_RATE_AUDIO_OFF_1080P_USD_PER_SECOND = 0.135;
var KLING_3_KIE_RATE_AUDIO_ON_1080P_USD_PER_SECOND = 0.2;
var KLING_3_KIE_RATE_AUDIO_OFF_720P_USD_PER_SECOND = 0.1;
var KLING_3_KIE_RATE_AUDIO_ON_720P_USD_PER_SECOND = 0.15;
var KIE_VEO_31_FAST_I2V_PER_VIDEO_USD = 0.3;
var SORA2_PRO_720P_USD_PER_SECOND = 0.3;
var SORA2_PRO_1080P_USD_PER_SECOND = 0.5;
var SEEDANCE_AUDIO_RATE_USD_PER_M_TOKEN = 2.4;
var SEEDANCE_NO_AUDIO_RATE_USD_PER_M_TOKEN = 1.2;
var SEEDANCE_DEFAULT_FPS = 24;
var SEEDANCE_RESOLUTION_MAP = {
    "1080p": { width: 1920, height: 1080 },
    "720p": { width: 1280, height: 720 },
    "480p": { width: 854, height: 480 },
};
var toCostBreakdown = function (_a) {
    var modelId = _a.modelId, usdRaw = _a.usdRaw, megapixels = _a.megapixels, width = _a.width, height = _a.height, applyMarkup = _a.applyMarkup;
    var quantized = (0, pricingCredits_1.convertUsdToCredits)({
        usdRaw: usdRaw,
        modelId: modelId,
        applyMarkup: applyMarkup !== null && applyMarkup !== void 0 ? applyMarkup : true,
    });
    return {
        credits: quantized.credits,
        usd: quantized.billedUsd,
        rawCredits: quantized.rawCredits,
        usdRaw: usdRaw,
        megapixels: megapixels,
        width: width,
        height: height,
    };
};
var resolveDefaultDuration = function (params, fallback) {
    var config = params.modelId ? (0, modelRegistry_1.getModelConfig)(params.modelId) : null;
    var configDefault = config === null || config === void 0 ? void 0 : config.defaultDurationSeconds;
    return Number.isFinite(params.durationSeconds) && params.durationSeconds
        ? params.durationSeconds
        : Number.isFinite(configDefault) && configDefault
            ? configDefault
            : fallback;
};
var resolveDefaultResolution = function (params, fallback) {
    var _a, _b;
    var config = params.modelId ? (0, modelRegistry_1.getModelConfig)(params.modelId) : null;
    return (_b = (_a = params.resolution) !== null && _a !== void 0 ? _a : config === null || config === void 0 ? void 0 : config.defaultResolution) !== null && _b !== void 0 ? _b : fallback;
};
var resolveDefaultAudio = function (params, fallback) {
    var _a, _b;
    var config = params.modelId ? (0, modelRegistry_1.getModelConfig)(params.modelId) : null;
    return (_b = (_a = params.audio) !== null && _a !== void 0 ? _a : config === null || config === void 0 ? void 0 : config.defaultAudio) !== null && _b !== void 0 ? _b : fallback;
};
var resolveImageSizeForMp = function (params) {
    var _a, _b;
    var width = Number((_a = params.imageWidth) !== null && _a !== void 0 ? _a : 0);
    var height = Number((_b = params.imageHeight) !== null && _b !== void 0 ? _b : 0);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        return {
            width: Math.round(width),
            height: Math.round(height),
        };
    }
    var config = (0, modelRegistry_1.getModelConfig)(params.modelId);
    if (!(config === null || config === void 0 ? void 0 : config.sizeMap))
        return null;
    return (0, modelSizes_1.resolveAspectSize)(params.aspect, config.sizeMap, config.defaultAspect);
};
var computeFalPerMpCost = function (_a) {
    var modelId = _a.modelId, aspect = _a.aspect, imageWidth = _a.imageWidth, imageHeight = _a.imageHeight;
    var size = resolveImageSizeForMp({ modelId: modelId, aspect: aspect, imageWidth: imageWidth, imageHeight: imageHeight });
    if (!size)
        return null;
    var megapixels = (size.width * size.height) / 1000000;
    var roundedMp = Math.ceil(megapixels);
    var usdRaw = roundedMp * FAL_COST_PER_MP_USD;
    return toCostBreakdown({
        modelId: modelId,
        usdRaw: usdRaw,
        megapixels: megapixels,
        width: size.width,
        height: size.height,
    });
};
var computeFlux2PerMpCost = function (_a) {
    var modelId = _a.modelId, aspect = _a.aspect, imageWidth = _a.imageWidth, imageHeight = _a.imageHeight;
    var size = resolveImageSizeForMp({ modelId: modelId, aspect: aspect, imageWidth: imageWidth, imageHeight: imageHeight });
    if (!size)
        return null;
    var megapixels = (size.width * size.height) / 1000000;
    var usdRaw = modelId === "fal/flux-2/edit"
        ? (FLUX2_EDIT_INPUT_MP + megapixels) * FLUX2_COST_PER_MP_USD
        : megapixels * FLUX2_COST_PER_MP_USD;
    return toCostBreakdown({
        modelId: modelId,
        usdRaw: usdRaw,
        megapixels: megapixels,
        width: size.width,
        height: size.height,
    });
};
var computeFlux2KleinPerMpCost = function (_a) {
    var modelId = _a.modelId, aspect = _a.aspect, imageWidth = _a.imageWidth, imageHeight = _a.imageHeight;
    var size = resolveImageSizeForMp({ modelId: modelId, aspect: aspect, imageWidth: imageWidth, imageHeight: imageHeight });
    if (!size)
        return null;
    var megapixels = (size.width * size.height) / 1000000;
    var usdRaw = modelId === "fal-ai/bria/background/remove"
        ? BRIA_BACKGROUND_REMOVE_PER_IMAGE_USD
        : megapixels * FLUX2_KLEIN_COST_PER_MP_USD;
    return toCostBreakdown({
        modelId: modelId,
        usdRaw: usdRaw,
        megapixels: megapixels,
        width: size.width,
        height: size.height,
    });
};
var computeFlux2ProPerMpCost = function (_a) {
    var modelId = _a.modelId, aspect = _a.aspect, imageWidth = _a.imageWidth, imageHeight = _a.imageHeight;
    var size = resolveImageSizeForMp({ modelId: modelId, aspect: aspect, imageWidth: imageWidth, imageHeight: imageHeight });
    if (!size)
        return null;
    var megapixels = (size.width * size.height) / 1000000;
    var roundedOutputMp = Math.max(1, Math.ceil(megapixels));
    var usdRaw = (function () {
        if (modelId === "fal-ai/flux-pro/v1/fill") {
            return roundedOutputMp * FLUX_PRO_FILL_COST_PER_MP_USD;
        }
        if (modelId === "fal/flux-2-pro/edit") {
            // Provider pricing includes output first MP plus additional rounded output+input MP.
            // Runtime normalizes edit input to 1 MP for deterministic debit parity.
            var additionalUnits = Math.max(0, roundedOutputMp - 1) + FLUX2_PRO_EDIT_NORMALIZED_INPUT_MP;
            return FLUX2_PRO_FIRST_MP_USD + additionalUnits * FLUX2_PRO_ADDITIONAL_MP_USD;
        }
        return FLUX2_PRO_FIRST_MP_USD + Math.max(0, roundedOutputMp - 1) * FLUX2_PRO_ADDITIONAL_MP_USD;
    })();
    return toCostBreakdown({
        modelId: modelId,
        usdRaw: usdRaw,
        megapixels: megapixels,
        width: size.width,
        height: size.height,
    });
};
var computeGoogleNanoBananaPerImageCost = function (_a) {
    var modelId = _a.modelId;
    return toCostBreakdown({
        modelId: modelId,
        usdRaw: GOOGLE_NANO_BANANA_PER_IMAGE_USD,
        megapixels: 0,
        width: 0,
        height: 0,
    });
};
var computeGptImagePerImageCost = function (_a) {
    var modelId = _a.modelId;
    return toCostBreakdown({
        modelId: modelId,
        usdRaw: GPT_IMAGE_PER_IMAGE_USD,
        megapixels: 0,
        width: 0,
        height: 0,
    });
};
var computeGpt41NanoPerTokenCost = function (_a) {
    var modelId = _a.modelId, _b = _a.inputTokens, inputTokens = _b === void 0 ? 0 : _b, _c = _a.outputTokens, outputTokens = _c === void 0 ? 0 : _c;
    // Rates are per 1M tokens: input $0.10, output $0.025.
    var INPUT_USD_PER_M = 0.1;
    var OUTPUT_USD_PER_M = 0.025;
    var totalUsd = (Math.max(0, inputTokens) / 1000000) * INPUT_USD_PER_M +
        (Math.max(0, outputTokens) / 1000000) * OUTPUT_USD_PER_M;
    return toCostBreakdown({
        modelId: modelId,
        usdRaw: totalUsd,
        megapixels: 0,
        width: 0,
        height: 0,
    });
};
var computeSeedreamPerImageCost = function (_a) {
    var modelId = _a.modelId, resolution = _a.resolution;
    var baseUsd = 0.04;
    var resolutionMultiplier = resolution === "4K" ? 2 : 1;
    return toCostBreakdown({
        modelId: modelId,
        usdRaw: baseUsd * resolutionMultiplier,
        megapixels: 0,
        width: 0,
        height: 0,
    });
};
var computeSeedream5LitePerImageCost = function (_a) {
    var modelId = _a.modelId;
    return toCostBreakdown({
        modelId: modelId,
        usdRaw: 0.035,
        megapixels: 0,
        width: 0,
        height: 0,
    });
};
var computeNanoBanana2PerImageCost = function (_a) {
    var modelId = _a.modelId, resolution = _a.resolution, webSearch = _a.webSearch;
    var baseUsd = 0.08;
    var normalizedResolution = (resolution !== null && resolution !== void 0 ? resolution : "1K").trim().toUpperCase();
    var resolutionMultiplier = normalizedResolution === "4K"
        ? 2
        : normalizedResolution === "2K"
            ? 1.5
            : normalizedResolution === "0.5K"
                ? 0.75
                : 1;
    var webSearchUsd = webSearch ? 0.015 : 0;
    return toCostBreakdown({
        modelId: modelId,
        usdRaw: baseUsd * resolutionMultiplier + webSearchUsd,
        megapixels: 0,
        width: 0,
        height: 0,
    });
};
var computeNanoBananaPerImageCost = function (_a) {
    var modelId = _a.modelId, resolution = _a.resolution, webSearch = _a.webSearch;
    var baseUsd = 0.15;
    var resolutionMultiplier = resolution === "4K" ? 2 : 1;
    var webSearchUsd = webSearch ? 0.015 : 0;
    return toCostBreakdown({
        modelId: modelId,
        usdRaw: baseUsd * resolutionMultiplier + webSearchUsd,
        megapixels: 0,
        width: 0,
        height: 0,
    });
};
var computeKling3PerSecondCost = function (params) {
    var duration = resolveDefaultDuration(params, exports.DEFAULT_KLING_DURATION_SECONDS);
    var hasAudio = resolveDefaultAudio(params, true);
    var usesVoiceControl = params.voiceControl === true;
    var isKieModel = params.modelId === providerModelIds_1.KIE_KLING_30_MODEL_ID;
    var rates = isKieModel
        ? (function () {
            var res = resolveDefaultResolution(params, "1080p").toLowerCase();
            var is720p = res.includes("720");
            return {
                audioOff: is720p
                    ? KLING_3_KIE_RATE_AUDIO_OFF_720P_USD_PER_SECOND
                    : KLING_3_KIE_RATE_AUDIO_OFF_1080P_USD_PER_SECOND,
                audioOn: is720p
                    ? KLING_3_KIE_RATE_AUDIO_ON_720P_USD_PER_SECOND
                    : KLING_3_KIE_RATE_AUDIO_ON_1080P_USD_PER_SECOND,
                // Kie pricing evidence does not publish a separate voice-control tier.
                audioVoice: is720p
                    ? KLING_3_KIE_RATE_AUDIO_ON_720P_USD_PER_SECOND
                    : KLING_3_KIE_RATE_AUDIO_ON_1080P_USD_PER_SECOND,
            };
        })()
        : {
            audioOff: KLING_3_FAL_RATE_AUDIO_OFF_USD_PER_SECOND,
            audioOn: KLING_3_FAL_RATE_AUDIO_ON_USD_PER_SECOND,
            audioVoice: KLING_3_FAL_RATE_AUDIO_VOICE_USD_PER_SECOND,
        };
    var usdPerSecond = hasAudio
        ? usesVoiceControl
            ? rates.audioVoice
            : rates.audioOn
        : rates.audioOff;
    var usd = usdPerSecond * duration;
    return toCostBreakdown({
        modelId: params.modelId,
        usdRaw: usd,
        megapixels: 0,
        width: 0,
        height: 0,
    });
};
var computeVeoPerSecondCost = function (params) {
    if (params.modelId === providerModelIds_1.KIE_VEO_31_FAST_I2V_MODEL_ID) {
        return toCostBreakdown({
            modelId: params.modelId,
            usdRaw: KIE_VEO_31_FAST_I2V_PER_VIDEO_USD,
            megapixels: 0,
            width: 0,
            height: 0,
        });
    }
    var duration = resolveDefaultDuration(params, 8);
    var res = resolveDefaultResolution(params, "1080p").toLowerCase();
    var hasAudio = resolveDefaultAudio(params, true);
    var is4k = res.includes("4k");
    var usdPerSecond = is4k
        ? hasAudio
            ? VEO_AUDIO_RATE_4K_USD_PER_SECOND
            : VEO_NO_AUDIO_RATE_4K_USD_PER_SECOND
        : hasAudio
            ? VEO_AUDIO_RATE_1080P_USD_PER_SECOND
            : VEO_NO_AUDIO_RATE_1080P_USD_PER_SECOND;
    var usd = usdPerSecond * duration;
    return toCostBreakdown({
        modelId: params.modelId,
        usdRaw: usd,
        megapixels: 0,
        width: 0,
        height: 0,
    });
};
var computeSora2ProPerSecondCost = function (params) {
    var duration = resolveDefaultDuration(params, 8);
    var res = resolveDefaultResolution(params, "1080p").toLowerCase();
    var usdPerSecond = res.includes("720")
        ? SORA2_PRO_720P_USD_PER_SECOND
        : SORA2_PRO_1080P_USD_PER_SECOND;
    var usd = usdPerSecond * duration;
    return toCostBreakdown({
        modelId: params.modelId,
        usdRaw: usd,
        megapixels: 0,
        width: 0,
        height: 0,
    });
};
var resolveSeedanceDuration = function (value) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return 10;
    if (value <= 4)
        return 4;
    if (value <= 5)
        return 5;
    if (value <= 6)
        return 6;
    if (value <= 7)
        return 7;
    if (value <= 8)
        return 8;
    if (value <= 9)
        return 9;
    if (value <= 10)
        return 10;
    if (value <= 11)
        return 11;
    return 12;
};
var computeSeedancePerSecondCost = function (params) {
    var duration = resolveSeedanceDuration(params.durationSeconds);
    var res = resolveDefaultResolution(params, "1080p").toLowerCase();
    var resolutionKey = res.includes("1080")
        ? "1080p"
        : res.includes("720") || res.includes("high")
            ? "720p"
            : "480p";
    var resolution = SEEDANCE_RESOLUTION_MAP[resolutionKey];
    if (!resolution)
        return null;
    var hasAudio = resolveDefaultAudio(params, true);
    var ratePerMillionTokens = hasAudio
        ? SEEDANCE_AUDIO_RATE_USD_PER_M_TOKEN
        : SEEDANCE_NO_AUDIO_RATE_USD_PER_M_TOKEN;
    var tokens = (resolution.width * resolution.height * SEEDANCE_DEFAULT_FPS * duration) / 1024;
    var usdRaw = (tokens / 1000000) * ratePerMillionTokens;
    return toCostBreakdown({
        modelId: params.modelId,
        usdRaw: usdRaw,
        megapixels: 0,
        width: resolution.width,
        height: resolution.height,
    });
};
exports.pricingStrategies = {
    "fal-per-mp": computeFalPerMpCost,
    "fal-flux2-per-mp": computeFlux2PerMpCost,
    "fal-flux2-klein-per-mp": computeFlux2KleinPerMpCost,
    "fal-flux2-pro-per-mp": computeFlux2ProPerMpCost,
    "gpt-image-per-image": computeGptImagePerImageCost,
    "google-nano-banana-per-image": computeGoogleNanoBananaPerImageCost,
    "nano-banana-2-per-image": computeNanoBanana2PerImageCost,
    "gpt41nano-per-token": computeGpt41NanoPerTokenCost,
    "nano-banana-per-image": computeNanoBananaPerImageCost,
    "seedream-per-image": computeSeedreamPerImageCost,
    "seedream-5-lite-per-image": computeSeedream5LitePerImageCost,
    "kling-3-per-second": computeKling3PerSecondCost,
    "veo-3-per-second": computeVeoPerSecondCost,
    "sora-2-pro-per-second": computeSora2ProPerSecondCost,
    "seedance-1.5-per-second": computeSeedancePerSecondCost,
};
