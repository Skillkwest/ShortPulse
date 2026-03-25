"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateDescribeTokens = exports.estimatePromptTokens = void 0;
/**
 * Token estimation helpers for text prompt refinement.
 * Roughly maps characters to tokens so we can pre-compute credit costs client-side.
 */
var estimatePromptTokens = function (prompt) {
    var _a;
    var charCount = (_a = prompt === null || prompt === void 0 ? void 0 : prompt.length) !== null && _a !== void 0 ? _a : 0;
    var inputTokens = Math.max(1, Math.ceil(charCount / 4));
    var outputTokens = Math.max(200, Math.ceil(inputTokens * 1.2));
    return { inputTokens: inputTokens, outputTokens: outputTokens };
};
exports.estimatePromptTokens = estimatePromptTokens;
var estimateDescribeTokens = function (outputText) {
    var outputTokens = (outputText === null || outputText === void 0 ? void 0 : outputText.length) ? Math.max(80, Math.ceil(outputText.length / 4)) : 240;
    // Assume a small vision prompt budget for system/user scaffolding.
    var inputTokens = 200;
    return { inputTokens: inputTokens, outputTokens: outputTokens };
};
exports.estimateDescribeTokens = estimateDescribeTokens;
