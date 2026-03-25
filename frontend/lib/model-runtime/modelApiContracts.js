"use strict";
/**
 * Provider API contract manifest for AI Studio models.
 * Centralizes aspect/resolution/duration capabilities verified against model docs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEffectiveAspectForModel = exports.getModelDefaultDurationSeconds = exports.getModelAllowedDurations = exports.getModelDefaultResolution = exports.getModelAllowedResolutions = exports.getModelDefaultAspect = exports.getModelAllowedAspects = exports.getModelApiContract = exports.listModelApiContracts = void 0;
var modelCatalog_1 = require("./modelCatalog");
var contracts = Object.fromEntries((0, modelCatalog_1.listModelCatalogEntries)().map(function (entry) { return [
    entry.modelId,
    {
        modelId: entry.modelId,
        defaultAspect: entry.defaultAspect,
        allowedAspects: entry.allowedAspects,
        defaultResolution: entry.defaultResolution,
        allowedResolutions: entry.allowedResolutions,
        defaultDurationSeconds: entry.defaultDurationSeconds,
        allowedDurations: entry.allowedDurations,
        submitAspectField: entry.submitAspectField,
        sourceUrl: entry.sourceUrl,
        verifiedAt: entry.verifiedAt,
    },
]; }));
var listModelApiContracts = function () { return Object.values(contracts); };
exports.listModelApiContracts = listModelApiContracts;
var getModelApiContract = function (modelId) { var _a; return (_a = contracts[modelId]) !== null && _a !== void 0 ? _a : null; };
exports.getModelApiContract = getModelApiContract;
var getModelAllowedAspects = function (modelId, fallback) {
    var _a;
    if (fallback === void 0) { fallback = []; }
    var contract = (0, exports.getModelApiContract)(modelId);
    return ((_a = contract === null || contract === void 0 ? void 0 : contract.allowedAspects) === null || _a === void 0 ? void 0 : _a.length) ? contract.allowedAspects : fallback;
};
exports.getModelAllowedAspects = getModelAllowedAspects;
var getModelDefaultAspect = function (modelId, fallback) {
    var _a, _b;
    return (_b = (_a = (0, exports.getModelApiContract)(modelId)) === null || _a === void 0 ? void 0 : _a.defaultAspect) !== null && _b !== void 0 ? _b : fallback;
};
exports.getModelDefaultAspect = getModelDefaultAspect;
var getModelAllowedResolutions = function (modelId, fallback) {
    var contract = (0, exports.getModelApiContract)(modelId);
    if (contract === null || contract === void 0 ? void 0 : contract.allowedResolutions)
        return contract.allowedResolutions;
    return fallback;
};
exports.getModelAllowedResolutions = getModelAllowedResolutions;
var getModelDefaultResolution = function (modelId, fallback) {
    var contract = (0, exports.getModelApiContract)(modelId);
    if (typeof (contract === null || contract === void 0 ? void 0 : contract.defaultResolution) === "string")
        return contract.defaultResolution;
    return fallback;
};
exports.getModelDefaultResolution = getModelDefaultResolution;
var getModelAllowedDurations = function (modelId, fallback) {
    var contract = (0, exports.getModelApiContract)(modelId);
    if (contract === null || contract === void 0 ? void 0 : contract.allowedDurations)
        return contract.allowedDurations;
    return fallback;
};
exports.getModelAllowedDurations = getModelAllowedDurations;
var getModelDefaultDurationSeconds = function (modelId, fallback) {
    var contract = (0, exports.getModelApiContract)(modelId);
    if (typeof (contract === null || contract === void 0 ? void 0 : contract.defaultDurationSeconds) === "number")
        return contract.defaultDurationSeconds;
    return fallback;
};
exports.getModelDefaultDurationSeconds = getModelDefaultDurationSeconds;
var resolveEffectiveAspectForModel = function (modelId, requestedAspect, fallback) {
    var _a;
    if (fallback === void 0) { fallback = "16:9"; }
    var contract = (0, exports.getModelApiContract)(modelId);
    var next = requestedAspect === null || requestedAspect === void 0 ? void 0 : requestedAspect.trim();
    if (!contract) {
        return next && next.length ? next : fallback;
    }
    if (!contract.allowedAspects.length) {
        return next && next.length ? next : contract.defaultAspect;
    }
    if (next && contract.allowedAspects.includes(next)) {
        return next;
    }
    if (contract.allowedAspects.includes(contract.defaultAspect)) {
        return contract.defaultAspect;
    }
    return (_a = contract.allowedAspects[0]) !== null && _a !== void 0 ? _a : fallback;
};
exports.resolveEffectiveAspectForModel = resolveEffectiveAspectForModel;
