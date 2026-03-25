"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRegenerateReferencePool = exports.buildVideoReferenceInputs = exports.buildImageReferenceInputs = void 0;
var isImageTool = function (tool) { return tool === "image" || tool === "edit"; };
var isVideoTool = function (tool) { return tool === "video" || tool === "kling"; };
/**
 * Builds ordered image references (primary first, then non-duplicate extras).
 */
var buildImageReferenceInputs = function (primary, extras) {
    var orderedExtras = extras.filter(function (url) { return Boolean(url && url !== primary); });
    if (primary) {
        return __spreadArray([primary], orderedExtras, true);
    }
    return orderedExtras;
};
exports.buildImageReferenceInputs = buildImageReferenceInputs;
/**
 * Builds ordered video references based on mode constraints.
 */
var buildVideoReferenceInputs = function (primary, extras, referenceMode) {
    if (!primary)
        return [];
    if (referenceMode === "standard" || referenceMode === "motion") {
        return [primary];
    }
    var orderedExtras = extras.filter(function (url) { return Boolean(url && url !== primary); });
    return __spreadArray([primary], orderedExtras, true);
};
exports.buildVideoReferenceInputs = buildVideoReferenceInputs;
/**
 * Builds regenerate inputs while preventing active-output leakage into video pipelines.
 */
var buildRegenerateReferencePool = function (_a) {
    var selectedTool = _a.selectedTool, useReferenceImageIndicator = _a.useReferenceImageIndicator, activeOutputPreviewUrl = _a.activeOutputPreviewUrl, referenceUrl = _a.referenceUrl, extraUrls = _a.extraUrls, videoReferenceMode = _a.videoReferenceMode;
    if (isImageTool(selectedTool)) {
        return (0, exports.buildImageReferenceInputs)(referenceUrl, extraUrls);
    }
    if (isVideoTool(selectedTool)) {
        return (0, exports.buildVideoReferenceInputs)(referenceUrl, extraUrls, videoReferenceMode);
    }
    var includeActiveOutputReference = useReferenceImageIndicator && Boolean(activeOutputPreviewUrl);
    return __spreadArray(__spreadArray(__spreadArray([], (includeActiveOutputReference && activeOutputPreviewUrl ? [activeOutputPreviewUrl] : []), true), [
        referenceUrl
    ], false), extraUrls, true).filter(function (url) { return Boolean(url); });
};
exports.buildRegenerateReferencePool = buildRegenerateReferencePool;
