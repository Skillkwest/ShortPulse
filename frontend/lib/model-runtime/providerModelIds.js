"use strict";
/**
 * Canonical provider model-id constants shared across runtime catalog/registry
 * and server provider-integration boundaries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isKnownKieModelId = exports.KIE_SUPPORTED_MODEL_IDS = exports.KIE_KLING_30_MODEL_ID = exports.KIE_VEO_31_FAST_I2V_MODEL_ID = void 0;
exports.KIE_VEO_31_FAST_I2V_MODEL_ID = "kie-ai/veo-3.1-fast-i2v";
exports.KIE_KLING_30_MODEL_ID = "kie-ai/kling-3.0";
exports.KIE_SUPPORTED_MODEL_IDS = [
    exports.KIE_VEO_31_FAST_I2V_MODEL_ID,
    exports.KIE_KLING_30_MODEL_ID,
];
var supportedKieModelIdSet = new Set(exports.KIE_SUPPORTED_MODEL_IDS);
/**
 * Returns true when the model id is part of the canonical Kie model set.
 */
var isKnownKieModelId = function (modelId) {
    return supportedKieModelIdSet.has(modelId);
};
exports.isKnownKieModelId = isKnownKieModelId;
