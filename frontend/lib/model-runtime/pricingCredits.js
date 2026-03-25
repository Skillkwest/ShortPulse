"use strict";
/**
 * Shared credit-conversion helpers for model runtime pricing.
 * Converts provider USD to credits with optional markup and model-specific rounding.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertUsdToCredits = exports.resolveModelCreditRoundingMode = void 0;
var BIGINT_ZERO = BigInt(0);
var BIGINT_ONE = BigInt(1);
var CREDIT_USD_SCALE = BigInt(100); // 1 USD = 100 credits
var USD_MICRO_SCALE = BigInt(1000000); // 1e-6 USD precision
var MARKUP_NUMERATOR = BigInt(103);
var MARKUP_DENOMINATOR = BigInt(100);
var EXCEPTION_ROUNDING_MODEL_IDS = new Set([
    "fal-ai/flux-2/klein/9b",
    "fal-ai/bria/background/remove",
]);
var ceilDiv = function (numerator, denominator) {
    if (denominator <= BIGINT_ZERO)
        throw new Error("denominator must be positive");
    if (numerator <= BIGINT_ZERO)
        return BIGINT_ZERO;
    return (numerator + denominator - BIGINT_ONE) / denominator;
};
var parseScaledDecimal = function (value, scale) {
    var trimmed = value.trim();
    if (!trimmed)
        return BIGINT_ZERO;
    var negative = trimmed.startsWith("-");
    var normalized = negative ? trimmed.slice(1) : trimmed;
    if (!/^\d+(\.\d+)?$/.test(normalized)) {
        throw new Error("Unsupported decimal value: ".concat(value));
    }
    var _a = normalized.split("."), wholePart = _a[0], _b = _a[1], fractionalPartRaw = _b === void 0 ? "" : _b;
    var scaleDigits = scale.toString().length - 1;
    var fractionalPart = (fractionalPartRaw + "0".repeat(scaleDigits)).slice(0, scaleDigits);
    var whole = BigInt(wholePart || "0") * scale;
    var fraction = BigInt(fractionalPart || "0");
    var combined = whole + fraction;
    return negative ? -combined : combined;
};
var toMicroUsd = function (usdRaw) {
    if (!Number.isFinite(usdRaw))
        return BIGINT_ZERO;
    // toFixed normalizes binary floating-point jitter before bigint conversion.
    return parseScaledDecimal(usdRaw.toFixed(12), USD_MICRO_SCALE);
};
var resolveModelCreditRoundingMode = function (modelId) {
    return EXCEPTION_ROUNDING_MODEL_IDS.has(modelId) ? "ceil" : "nearest-5";
};
exports.resolveModelCreditRoundingMode = resolveModelCreditRoundingMode;
/**
 * Converts provider USD to credits with decimal-safe math.
 * Markup is applied before quantization.
 */
var convertUsdToCredits = function (_a) {
    var usdRaw = _a.usdRaw, modelId = _a.modelId, _b = _a.applyMarkup, applyMarkup = _b === void 0 ? true : _b;
    var usdMicro = toMicroUsd(usdRaw);
    if (usdMicro <= BIGINT_ZERO) {
        return {
            rawCredits: 0,
            credits: 0,
            billedUsd: 0,
        };
    }
    var numerator = usdMicro * CREDIT_USD_SCALE;
    var denominator = USD_MICRO_SCALE;
    if (applyMarkup) {
        numerator *= MARKUP_NUMERATOR;
        denominator *= MARKUP_DENOMINATOR;
    }
    var rawCredits = Number(ceilDiv(numerator, denominator));
    var roundingMode = (0, exports.resolveModelCreditRoundingMode)(modelId);
    var credits = roundingMode === "ceil" ? rawCredits : Math.ceil(rawCredits / 5) * 5;
    return {
        rawCredits: rawCredits,
        credits: credits,
        billedUsd: credits / 100,
    };
};
exports.convertUsdToCredits = convertUsdToCredits;
