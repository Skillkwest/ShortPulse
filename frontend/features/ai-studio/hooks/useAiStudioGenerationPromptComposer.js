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
exports.useAiStudioGenerationPromptComposer = void 0;
/**
 * AI Studio generation prompt/reference composition hook.
 * Owns prompt selection and ordered reference input composition for generate/regenerate submit paths.
 */
var react_1 = require("react");
var referenceInputs_1 = require("../logic/referenceInputs");
var stylePromptAdapter_1 = require("../logic/stylePromptAdapter");
var resolvePromptForTool = function (_a) {
    var tool = _a.tool, prompt = _a.prompt, editReferenceText = _a.editReferenceText, videoReferenceText = _a.videoReferenceText;
    var referencePromptForTool = tool === "video" || tool === "kling" ? videoReferenceText : editReferenceText;
    if (tool === "image" || tool === "edit" || tool === "video" || tool === "kling") {
        return referencePromptForTool;
    }
    return prompt;
};
var shouldAttachStyleContextForTool = function (tool) {
    return tool === "create" || tool === "text" || tool === "image" || tool === "edit";
};
/**
 * Returns generate/regenerate handlers with stable prompt and reference composition rules.
 */
var useAiStudioGenerationPromptComposer = function (_a) {
    var model = _a.model, prompt = _a.prompt, editReferenceText = _a.editReferenceText, videoReferenceText = _a.videoReferenceText, _b = _a.selectedStylePrompt, selectedStylePrompt = _b === void 0 ? null : _b, _c = _a.selectedStyleContext, selectedStyleContext = _c === void 0 ? null : _c, selectedTool = _a.selectedTool, videoReferenceMode = _a.videoReferenceMode, useReferenceImageIndicator = _a.useReferenceImageIndicator, activeOutputPreviewUrl = _a.activeOutputPreviewUrl, resolveReferenceInputsForTool = _a.resolveReferenceInputsForTool, submitTask = _a.submitTask;
    var stylePromptFamilyAdapterEnabled = (0, stylePromptAdapter_1.isStylePromptFamilyAdapterEnabled)();
    var resolveMergedReferenceInputs = (0, react_1.useCallback)(function (baseInputs, overrideInputs, overrideMode) {
        if (overrideMode === void 0) { overrideMode = "merge"; }
        var normalizeReferenceInputs = function (candidates) {
            return Array.from(new Set(candidates.map(function (value) { return value.trim(); }).filter(function (value) { return value.length > 0; }))).slice(0, 8);
        };
        if (!Array.isArray(overrideInputs)) {
            return normalizeReferenceInputs(baseInputs);
        }
        if (overrideMode === "replace") {
            return normalizeReferenceInputs(overrideInputs);
        }
        return normalizeReferenceInputs(__spreadArray(__spreadArray([], overrideInputs, true), baseInputs, true));
    }, []);
    var generateOutput = (0, react_1.useCallback)(function (promptOverride, options) {
        var _a, _b, _c, _d;
        var effectiveTool = (_a = options === null || options === void 0 ? void 0 : options.selectedToolOverride) !== null && _a !== void 0 ? _a : selectedTool;
        var defaultPromptForTool = resolvePromptForTool({
            tool: effectiveTool,
            prompt: prompt,
            editReferenceText: editReferenceText,
            videoReferenceText: videoReferenceText,
        });
        var displayPromptToSubmit = typeof (options === null || options === void 0 ? void 0 : options.displayPromptOverride) === "string"
            ? options.displayPromptOverride
            : typeof promptOverride === "string"
                ? promptOverride
                : defaultPromptForTool;
        var submissionPromptToSubmit = typeof (options === null || options === void 0 ? void 0 : options.submissionPromptOverride) === "string"
            ? options.submissionPromptOverride
            : displayPromptToSubmit;
        var effectiveModelId = (_b = options === null || options === void 0 ? void 0 : options.modelIdOverride) !== null && _b !== void 0 ? _b : model;
        var compiledSubmissionPrompt = (0, stylePromptAdapter_1.appendStylePromptToSubmission)({
            tool: effectiveTool,
            submissionPrompt: submissionPromptToSubmit,
            selectedStylePrompt: selectedStylePrompt,
            modelId: effectiveModelId,
            adapterEnabled: stylePromptFamilyAdapterEnabled,
        });
        var styleContextOverrideCandidate = (_d = (_c = options === null || options === void 0 ? void 0 : options.styleContextOverride) !== null && _c !== void 0 ? _c : selectedStyleContext) !== null && _d !== void 0 ? _d : undefined;
        var styleContextOverrideToSubmit = shouldAttachStyleContextForTool(effectiveTool)
            ? styleContextOverrideCandidate
            : undefined;
        var _e = resolveReferenceInputsForTool(effectiveTool), referenceUrl = _e.referenceImageUrl, extraUrls = _e.extraImageUrls;
        var isVideoGenerationTool = effectiveTool === "video" || effectiveTool === "kling";
        var baseInputs = effectiveTool === "image" || effectiveTool === "edit"
            ? (0, referenceInputs_1.buildImageReferenceInputs)(referenceUrl, extraUrls)
            : isVideoGenerationTool
                ? (0, referenceInputs_1.buildVideoReferenceInputs)(referenceUrl, extraUrls, videoReferenceMode)
                : __spreadArray([referenceUrl], extraUrls, true).filter(function (url) { return Boolean(url); });
        var imageInputs = resolveMergedReferenceInputs(baseInputs, options === null || options === void 0 ? void 0 : options.referenceInputsOverride, options === null || options === void 0 ? void 0 : options.referenceInputsMode);
        submitTask(compiledSubmissionPrompt, imageInputs, __assign(__assign({ modeOverride: options === null || options === void 0 ? void 0 : options.modeOverride, selectedToolOverride: options === null || options === void 0 ? void 0 : options.selectedToolOverride, displayPromptOverride: displayPromptToSubmit, characterContextOverride: options === null || options === void 0 ? void 0 : options.characterContextOverride, modelIdOverride: options === null || options === void 0 ? void 0 : options.modelIdOverride, inpaintOverride: options === null || options === void 0 ? void 0 : options.inpaintOverride, hideOutputFromReferenceGrid: options === null || options === void 0 ? void 0 : options.hideOutputFromReferenceGrid }, (styleContextOverrideToSubmit
            ? {
                styleContextOverride: styleContextOverrideToSubmit,
            }
            : {})), (typeof (options === null || options === void 0 ? void 0 : options.outputIdOverride) === "string"
            ? { outputIdOverride: options.outputIdOverride }
            : {})));
    }, [
        editReferenceText,
        model,
        prompt,
        resolveReferenceInputsForTool,
        resolveMergedReferenceInputs,
        selectedTool,
        selectedStylePrompt,
        selectedStyleContext,
        stylePromptFamilyAdapterEnabled,
        submitTask,
        videoReferenceMode,
        videoReferenceText,
    ]);
    var regenerateOutput = (0, react_1.useCallback)(function (options) {
        var _a, _b, _c;
        var promptForTool = resolvePromptForTool({
            tool: selectedTool,
            prompt: prompt,
            editReferenceText: editReferenceText,
            videoReferenceText: videoReferenceText,
        });
        var displayPromptToUse = typeof (options === null || options === void 0 ? void 0 : options.displayPromptOverride) === "string"
            ? options.displayPromptOverride.trim()
            : promptForTool.trim();
        var submissionPromptToUse = typeof (options === null || options === void 0 ? void 0 : options.submissionPromptOverride) === "string"
            ? options.submissionPromptOverride.trim()
            : displayPromptToUse;
        var effectiveModelId = (_a = options === null || options === void 0 ? void 0 : options.modelIdOverride) !== null && _a !== void 0 ? _a : model;
        var compiledSubmissionPrompt = (0, stylePromptAdapter_1.appendStylePromptToSubmission)({
            tool: selectedTool,
            submissionPrompt: submissionPromptToUse,
            selectedStylePrompt: selectedStylePrompt,
            modelId: effectiveModelId,
            adapterEnabled: stylePromptFamilyAdapterEnabled,
        });
        var styleContextOverrideCandidate = (_c = (_b = options === null || options === void 0 ? void 0 : options.styleContextOverride) !== null && _b !== void 0 ? _b : selectedStyleContext) !== null && _c !== void 0 ? _c : undefined;
        var styleContextOverrideToSubmit = shouldAttachStyleContextForTool(selectedTool)
            ? styleContextOverrideCandidate
            : undefined;
        var _d = resolveReferenceInputsForTool(selectedTool), referenceUrl = _d.referenceImageUrl, extraUrls = _d.extraImageUrls;
        var referencePool = (0, referenceInputs_1.buildRegenerateReferencePool)({
            selectedTool: selectedTool,
            useReferenceImageIndicator: useReferenceImageIndicator,
            activeOutputPreviewUrl: activeOutputPreviewUrl,
            referenceUrl: referenceUrl,
            extraUrls: extraUrls,
            videoReferenceMode: videoReferenceMode,
        });
        var imageInputs = resolveMergedReferenceInputs(referencePool, options === null || options === void 0 ? void 0 : options.referenceInputsOverride, options === null || options === void 0 ? void 0 : options.referenceInputsMode);
        submitTask(compiledSubmissionPrompt, imageInputs, __assign({ displayPromptOverride: displayPromptToUse, characterContextOverride: options === null || options === void 0 ? void 0 : options.characterContextOverride, modelIdOverride: options === null || options === void 0 ? void 0 : options.modelIdOverride, inpaintOverride: options === null || options === void 0 ? void 0 : options.inpaintOverride, hideOutputFromReferenceGrid: options === null || options === void 0 ? void 0 : options.hideOutputFromReferenceGrid }, (styleContextOverrideToSubmit
            ? {
                styleContextOverride: styleContextOverrideToSubmit,
            }
            : {})));
    }, [
        activeOutputPreviewUrl,
        editReferenceText,
        model,
        prompt,
        resolveReferenceInputsForTool,
        resolveMergedReferenceInputs,
        selectedTool,
        selectedStylePrompt,
        selectedStyleContext,
        stylePromptFamilyAdapterEnabled,
        submitTask,
        useReferenceImageIndicator,
        videoReferenceMode,
        videoReferenceText,
    ]);
    return {
        generateOutput: generateOutput,
        regenerateOutput: regenerateOutput,
    };
};
exports.useAiStudioGenerationPromptComposer = useAiStudioGenerationPromptComposer;
