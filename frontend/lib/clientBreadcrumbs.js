"use strict";
/**
 * Client-side breadcrumb buffer for error triage.
 * Intentionally sanitized: never store DOM text, form values, or arbitrary payloads.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearBreadcrumbs = exports.getBreadcrumbsSnapshot = exports.addBreadcrumb = exports.redactUrlForTelemetry = void 0;
var MAX_BREADCRUMBS = 25;
var MAX_MESSAGE_LENGTH = 160;
var MAX_KEY_LENGTH = 40;
var MAX_VALUE_LENGTH = 240;
var buffer = [];
var sanitizeText = function (value, max) {
    if (max === void 0) { max = MAX_VALUE_LENGTH; }
    if (typeof value !== "string")
        return null;
    var trimmed = value.trim();
    if (!trimmed)
        return null;
    return trimmed.length > max ? "".concat(trimmed.slice(0, max), "\u2026") : trimmed;
};
var sanitizeKey = function (key) {
    var trimmed = key.trim();
    if (trimmed.length <= MAX_KEY_LENGTH)
        return trimmed;
    return trimmed.slice(0, MAX_KEY_LENGTH);
};
var sanitizeValue = function (value) {
    if (value == null)
        return null;
    if (typeof value === "boolean")
        return value;
    if (typeof value === "number") {
        if (!Number.isFinite(value))
            return null;
        return value;
    }
    if (typeof value === "string")
        return sanitizeText(value, MAX_VALUE_LENGTH);
    return null;
};
var sanitizeData = function (data) {
    if (!data)
        return undefined;
    var out = {};
    for (var _i = 0, _a = Object.entries(data); _i < _a.length; _i++) {
        var _b = _a[_i], rawKey = _b[0], rawValue = _b[1];
        var key = sanitizeKey(rawKey);
        var value = sanitizeValue(rawValue);
        if (value == null)
            continue;
        out[key] = value;
    }
    return Object.keys(out).length ? out : undefined;
};
/**
 * Redacts query values while keeping the path + query keys for debugging.
 * Example: `/api/users?email=foo&limit=50` -> `/api/users?email&limit`
 */
var redactUrlForTelemetry = function (value) {
    var input = value.trim();
    if (!input)
        return input;
    var splitIndex = input.indexOf("?");
    if (splitIndex === -1)
        return input;
    var path = input.slice(0, splitIndex);
    var query = input.slice(splitIndex + 1);
    var keys = query
        .split("&")
        .map(function (part) { var _a; return (_a = part.split("=")[0]) === null || _a === void 0 ? void 0 : _a.trim(); })
        .filter(Boolean)
        .slice(0, 12);
    if (!keys.length)
        return path;
    return "".concat(path, "?").concat(keys.join("&"));
};
exports.redactUrlForTelemetry = redactUrlForTelemetry;
var addBreadcrumb = function (crumb) {
    var _a, _b;
    var message = (_a = sanitizeText(crumb.message, MAX_MESSAGE_LENGTH)) !== null && _a !== void 0 ? _a : sanitizeText(String(crumb.message), MAX_MESSAGE_LENGTH);
    if (!message)
        return;
    buffer.push({
        t: Date.now(),
        type: crumb.type,
        level: (_b = crumb.level) !== null && _b !== void 0 ? _b : "info",
        message: message,
        data: sanitizeData(crumb.data),
    });
    if (buffer.length > MAX_BREADCRUMBS) {
        buffer.splice(0, buffer.length - MAX_BREADCRUMBS);
    }
};
exports.addBreadcrumb = addBreadcrumb;
var getBreadcrumbsSnapshot = function () { return buffer.slice(); };
exports.getBreadcrumbsSnapshot = getBreadcrumbsSnapshot;
var clearBreadcrumbs = function () {
    buffer.length = 0;
};
exports.clearBreadcrumbs = clearBreadcrumbs;
