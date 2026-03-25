"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeFalFluxCost = exports.computeCostForModel = exports.falSizeForAspect = exports.buildDefaultPricingParams = exports.DEFAULT_KLING_DURATION_SECONDS = exports.falImageSizeMap = exports.listModelConfigs = exports.getModelConfig = void 0;
/**
 * Runtime-owned pricing facade used by server and feature layers.
 */
var modelRegistry_1 = require("./modelRegistry");
var modelSizes_1 = require("./modelSizes");
var pricingStrategies_1 = require("./pricingStrategies");
var modelRegistry_2 = require("./modelRegistry");
Object.defineProperty(exports, "getModelConfig", { enumerable: true, get: function () { return modelRegistry_2.getModelConfig; } });
var modelRegistry_3 = require("./modelRegistry");
Object.defineProperty(exports, "listModelConfigs", { enumerable: true, get: function () { return modelRegistry_3.listModelConfigs; } });
var modelSizes_2 = require("./modelSizes");
Object.defineProperty(exports, "falImageSizeMap", { enumerable: true, get: function () { return modelSizes_2.falImageSizeMap; } });
var pricingStrategies_2 = require("./pricingStrategies");
Object.defineProperty(exports, "DEFAULT_KLING_DURATION_SECONDS", { enumerable: true, get: function () { return pricingStrategies_2.DEFAULT_KLING_DURATION_SECONDS; } });
var buildDefaultPricingParams = function (modelId, overrides) {
    if (overrides === void 0) { overrides = {}; }
    var config = (0, modelRegistry_1.getModelConfig)(modelId);
    if (!config)
        return overrides;
    var defaults = {};
    if (config.defaultAspect)
        defaults.aspect = config.defaultAspect;
    if (config.defaultDurationSeconds)
        defaults.durationSeconds = config.defaultDurationSeconds;
    if (config.defaultResolution)
        defaults.resolution = config.defaultResolution;
    if (config.defaultAudio !== undefined)
        defaults.audio = config.defaultAudio;
    return __assign(__assign({}, defaults), overrides);
};
exports.buildDefaultPricingParams = buildDefaultPricingParams;
var falSizeForAspect = function (aspect) { var _a; return (_a = (0, modelSizes_1.resolveAspectSize)(aspect, modelSizes_1.falImageSizeMap, "4:3")) !== null && _a !== void 0 ? _a : modelSizes_1.falImageSizeMap["4:3"]; };
exports.falSizeForAspect = falSizeForAspect;
var computeCostForModel = function (modelId, params) {
    if (params === void 0) { params = {}; }
    var config = (0, modelRegistry_1.getModelConfig)(modelId);
    if (!config)
        return null;
    var strategy = pricingStrategies_1.pricingStrategies[config.pricingStrategy];
    if (!strategy)
        return null;
    return strategy(__assign(__assign({}, params), { modelId: modelId }));
};
exports.computeCostForModel = computeCostForModel;
// Backward-compatible helper for existing call sites.
var computeFalFluxCost = function (aspect) {
    var result = (0, exports.computeCostForModel)("fal/flux-2", { aspect: aspect });
    if (result)
        return result;
    return { credits: 0, usd: 0, rawCredits: 0, usdRaw: 0, megapixels: 0, width: 0, height: 0 };
};
exports.computeFalFluxCost = computeFalFluxCost;
