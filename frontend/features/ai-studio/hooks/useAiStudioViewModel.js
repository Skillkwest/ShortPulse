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
exports.useAiStudioViewModel = void 0;
/**
 * View-model helper for AI Studio page.
 * Computes pricing, guardrails, and derived flags to keep the page lean.
 */
var react_1 = require("react");
var pricing_1 = require("../logic/pricing");
var tokenEstimates_1 = require("../logic/tokenEstimates");
var promptGeneration_1 = require("../logic/promptGeneration");
var imageResolution_1 = require("../logic/imageResolution");
var providerModelIds_1 = require("../../../lib/model-runtime/providerModelIds");
var editSubmitIntent_1 = require("../logic/editSubmitIntent");
var concurrentGenerationCap_1 = require("../logic/concurrentGenerationCap");
var workflowIdentity_1 = require("../logic/workflowIdentity");
var useAiStudioViewModel = function (_a) {
    var _b, _c, _d, _e;
    var mode = _a.mode, model = _a.model, aspect = _a.aspect, prompt = _a.prompt, referenceImageUrl = _a.referenceImageUrl, activeOutput = _a.activeOutput, selectedTool = _a.selectedTool, useReferenceImageIndicator = _a.useReferenceImageIndicator, getDefaultDurationSeconds = _a.getDefaultDurationSeconds, videoDurationSeconds = _a.videoDurationSeconds, videoResolution = _a.videoResolution, videoReferenceMode = _a.videoReferenceMode, motionReferenceVideoUrl = _a.motionReferenceVideoUrl, extraImageUrls = _a.extraImageUrls, imageResolution = _a.imageResolution, videoGenerateAudio = _a.videoGenerateAudio, balanceCredits = _a.balanceCredits, _f = _a.activeGenerationCount, activeGenerationCount = _f === void 0 ? 0 : _f, editSubmitIntent = _a.editSubmitIntent, costParamsForModel = _a.costParamsForModel;
    var isCreateWorkflowSelected = (0, workflowIdentity_1.isCreateWorkflow)(selectedTool);
    var isEditWorkflowSelected = (0, workflowIdentity_1.isEditWorkflow)(selectedTool);
    var isVideoWorkflowSelected = (0, workflowIdentity_1.isVideoWorkflow)(selectedTool);
    var effectiveEditSubmitModelId = (0, react_1.useMemo)(function () {
        return (0, editSubmitIntent_1.resolveEffectiveEditSubmitModelId)({
            selectedTool: selectedTool,
            selectedModelId: model,
            editSubmitIntent: editSubmitIntent,
        });
    }, [editSubmitIntent, model, selectedTool]);
    var isDescribeMode = isCreateWorkflowSelected && mode === "text" && useReferenceImageIndicator;
    var requiresModelSelection = (isCreateWorkflowSelected && mode !== "text") ||
        isVideoWorkflowSelected ||
        isEditWorkflowSelected;
    var isModelSelected = Boolean(effectiveEditSubmitModelId);
    var hasDescribeImage = Boolean(referenceImageUrl || (activeOutput === null || activeOutput === void 0 ? void 0 : activeOutput.previewUrl));
    var isVideoTool = isVideoWorkflowSelected;
    var isImageTool = (isCreateWorkflowSelected && mode === "image") || isEditWorkflowSelected;
    var pricingImageResolution = (0, react_1.useMemo)(function () { return (0, imageResolution_1.normalizeImageResolutionForPricing)(imageResolution); }, [imageResolution]);
    var estimatedTextTokens = (0, react_1.useMemo)(function () { return (0, tokenEstimates_1.estimatePromptTokens)(prompt); }, [prompt]);
    var estimatedDescribeTokens = (0, react_1.useMemo)(function () { return (prompt ? (0, tokenEstimates_1.estimatePromptTokens)(prompt) : (0, tokenEstimates_1.estimateDescribeTokens)()); }, [prompt]);
    var currentCost = (0, react_1.useMemo)(function () {
        if (isCreateWorkflowSelected) {
            if (mode === "image") {
                if (!model)
                    return null;
                return (0, pricing_1.computeCostForModel)(model, costParamsForModel(pricingImageResolution ? { resolution: pricingImageResolution } : {}));
            }
            if (mode === "video") {
                if (!model)
                    return null;
                return (0, pricing_1.computeCostForModel)(model, costParamsForModel({ durationSeconds: getDefaultDurationSeconds(model) }));
            }
            if (mode === "text") {
                if (isDescribeMode) {
                    return (0, pricing_1.computeCostForModel)(promptGeneration_1.TEXT_PROMPT_MODEL_ID, estimatedDescribeTokens);
                }
                return (0, pricing_1.computeCostForModel)(promptGeneration_1.TEXT_PROMPT_MODEL_ID, estimatedTextTokens);
            }
            return null;
        }
        if (isEditWorkflowSelected) {
            if (!effectiveEditSubmitModelId)
                return null;
            return (0, pricing_1.computeCostForModel)(effectiveEditSubmitModelId, costParamsForModel(pricingImageResolution ? { resolution: pricingImageResolution } : {}));
        }
        if (isVideoTool) {
            if (!model)
                return null;
            return (0, pricing_1.computeCostForModel)(model, costParamsForModel({
                durationSeconds: videoDurationSeconds,
                resolution: videoResolution,
                audio: videoGenerateAudio,
            }));
        }
        return null;
    }, [
        estimatedDescribeTokens,
        estimatedTextTokens,
        isDescribeMode,
        costParamsForModel,
        getDefaultDurationSeconds,
        mode,
        model,
        effectiveEditSubmitModelId,
        isCreateWorkflowSelected,
        isEditWorkflowSelected,
        isVideoTool,
        videoDurationSeconds,
        videoResolution,
        pricingImageResolution,
        videoGenerateAudio,
    ]);
    var currentCostCredits = (_b = currentCost === null || currentCost === void 0 ? void 0 : currentCost.credits) !== null && _b !== void 0 ? _b : null;
    // Cost shown in the model picker (also used by agent-output generation affordances).
    var modelPickerCostCredits = (0, react_1.useMemo)(function () {
        var _a;
        if (!effectiveEditSubmitModelId)
            return null;
        var breakdown = (0, pricing_1.computeCostForModel)(effectiveEditSubmitModelId, costParamsForModel(isVideoTool
            ? {
                durationSeconds: videoDurationSeconds,
                resolution: videoResolution,
                audio: videoGenerateAudio,
            }
            : isImageTool && pricingImageResolution
                ? { resolution: pricingImageResolution }
                : {}));
        return (_a = breakdown === null || breakdown === void 0 ? void 0 : breakdown.credits) !== null && _a !== void 0 ? _a : null;
    }, [
        costParamsForModel,
        effectiveEditSubmitModelId,
        isVideoTool,
        isImageTool,
        pricingImageResolution,
        videoDurationSeconds,
        videoGenerateAudio,
        videoResolution,
    ]);
    var resolveModelPickerCredits = (0, react_1.useCallback)(function (modelIdForChip) {
        var _a;
        if (!modelIdForChip)
            return null;
        var breakdown = (0, pricing_1.computeCostForModel)(modelIdForChip, costParamsForModel(isVideoTool
            ? {
                durationSeconds: videoDurationSeconds,
                resolution: videoResolution,
                audio: videoGenerateAudio,
            }
            : isImageTool && pricingImageResolution
                ? { resolution: pricingImageResolution }
                : {}));
        return (_a = breakdown === null || breakdown === void 0 ? void 0 : breakdown.credits) !== null && _a !== void 0 ? _a : null;
    }, [
        costParamsForModel,
        isImageTool,
        isVideoTool,
        pricingImageResolution,
        videoDurationSeconds,
        videoGenerateAudio,
        videoResolution,
    ]);
    var promptGenerateCostCredits = (0, react_1.useMemo)(function () {
        var _a;
        if (!effectiveEditSubmitModelId || !isImageTool)
            return null;
        var breakdown = (0, pricing_1.computeCostForModel)(effectiveEditSubmitModelId, costParamsForModel(__assign({ aspect: aspect }, (pricingImageResolution ? { resolution: pricingImageResolution } : {}))));
        return (_a = breakdown === null || breakdown === void 0 ? void 0 : breakdown.credits) !== null && _a !== void 0 ? _a : null;
    }, [aspect, costParamsForModel, effectiveEditSubmitModelId, isImageTool, pricingImageResolution]);
    var createTextImageGenerateCostCredits = (0, react_1.useMemo)(function () {
        var _a;
        if (!isCreateWorkflowSelected || mode !== "text" || !effectiveEditSubmitModelId)
            return null;
        var breakdown = (0, pricing_1.computeCostForModel)(effectiveEditSubmitModelId, costParamsForModel(__assign({ aspect: aspect }, (pricingImageResolution ? { resolution: pricingImageResolution } : {}))));
        return (_a = breakdown === null || breakdown === void 0 ? void 0 : breakdown.credits) !== null && _a !== void 0 ? _a : null;
    }, [
        aspect,
        costParamsForModel,
        effectiveEditSubmitModelId,
        isCreateWorkflowSelected,
        mode,
        pricingImageResolution,
    ]);
    var promptReferenceGenerateCostCredits = (_e = (_d = (_c = (isImageTool ? promptGenerateCostCredits : null)) !== null && _c !== void 0 ? _c : (isCreateWorkflowSelected && mode === "text" ? createTextImageGenerateCostCredits : null)) !== null && _d !== void 0 ? _d : modelPickerCostCredits) !== null && _e !== void 0 ? _e : currentCostCredits;
    var hasSufficientCreditsForPromptReferenceGenerate = balanceCredits == null || promptReferenceGenerateCostCredits == null
        ? true
        : balanceCredits >= promptReferenceGenerateCostCredits;
    var costedFlow = (isCreateWorkflowSelected && (mode === "image" || mode === "video")) ||
        isVideoTool ||
        isEditWorkflowSelected;
    var hasSufficientCreditsForCost = !costedFlow || balanceCredits == null || currentCostCredits == null
        ? true
        : balanceCredits >= currentCostCredits;
    var isCreditGuardrail = costedFlow && !hasSufficientCreditsForCost;
    var generationGuardrail = (0, react_1.useMemo)(function () {
        if (isCreateWorkflowSelected && mode === "text")
            return null;
        if (requiresModelSelection && !isModelSelected)
            return "Select a model before running a generation.";
        if (isEditWorkflowSelected) {
            if (!referenceImageUrl)
                return "Add a reference image before generating.";
        }
        if (isDescribeMode && !hasDescribeImage)
            return "Add or select an image to describe.";
        if (isVideoTool && videoReferenceMode === "standard" && !referenceImageUrl) {
            return "Add a reference image before generating.";
        }
        var isVeoFirstLastModel = model === "fal-ai/veo3.1/first-last-frame-to-video" || model === providerModelIds_1.KIE_VEO_31_FAST_I2V_MODEL_ID;
        var hasBothVeoFrames = Boolean(referenceImageUrl && extraImageUrls[0]);
        if (isVideoTool &&
            videoReferenceMode === "keyframes" &&
            isVeoFirstLastModel &&
            !hasBothVeoFrames) {
            return "Add both first and last frame images before generating.";
        }
        if (isVideoTool && videoReferenceMode === "motion") {
            var hasCharacterImage = Boolean(referenceImageUrl);
            var hasMotionVideo = Boolean(motionReferenceVideoUrl);
            if (!hasCharacterImage && !hasMotionVideo) {
                return "Add a character image and motion reference video before generating.";
            }
            if (!hasCharacterImage) {
                return "Add a character image before generating in Motion Control.";
            }
            if (!hasMotionVideo) {
                return "Add a motion reference video before generating in Motion Control.";
            }
        }
        if (activeGenerationCount >= concurrentGenerationCap_1.MAX_CONCURRENT_GENERATIONS) {
            return concurrentGenerationCap_1.CONCURRENT_GENERATION_CAP_MESSAGE;
        }
        if (isCreditGuardrail)
            return "You do not have enough credits for this run.";
        return null;
    }, [
        activeGenerationCount,
        extraImageUrls,
        hasDescribeImage,
        isVideoTool,
        isCreditGuardrail,
        isDescribeMode,
        isModelSelected,
        model,
        motionReferenceVideoUrl,
        referenceImageUrl,
        requiresModelSelection,
        mode,
        isCreateWorkflowSelected,
        isEditWorkflowSelected,
        videoReferenceMode,
    ]);
    var isGenerateDisabled = Boolean(generationGuardrail);
    var modelConfig = (0, react_1.useMemo)(function () { return (model ? (0, pricing_1.getModelConfig)(model) : null); }, [model]);
    // Warning when user hasn't provided reference image for image-to-image or image-to-video models
    var referenceImageWarning = (0, react_1.useMemo)(function () {
        if (!model || !modelConfig)
            return null;
        // Check if using image tool with image-to-image model but no reference
        if (isEditWorkflowSelected) {
            var hasReference = Boolean(referenceImageUrl);
            var isImageToImageOnly = modelConfig.supportsImageToImage && !modelConfig.supportsTextToImage;
            if (!hasReference && isImageToImageOnly) {
                return "No reference image detected. Edit workflow requires a reference image and will not fallback to text-to-image.";
            }
        }
        // Check if using video tool with image-to-video model but no reference
        if (isVideoTool) {
            var hasReference = Boolean(referenceImageUrl);
            var hasMotionVideo = Boolean(motionReferenceVideoUrl);
            if (videoReferenceMode === "motion") {
                if (!hasReference && !hasMotionVideo) {
                    return "Motion Control requires a character image and motion reference video.";
                }
                if (!hasReference) {
                    return "Motion Control requires a character reference image.";
                }
                if (!hasMotionVideo) {
                    return "Motion Control requires a motion reference video.";
                }
            }
        }
        return null;
    }, [
        model,
        modelConfig,
        isEditWorkflowSelected,
        referenceImageUrl,
        isVideoTool,
        videoReferenceMode,
        motionReferenceVideoUrl,
    ]);
    return {
        currentCost: currentCost,
        currentCostCredits: currentCostCredits,
        modelPickerCostCredits: modelPickerCostCredits,
        resolveModelPickerCredits: resolveModelPickerCredits,
        promptGenerateCostCredits: promptGenerateCostCredits,
        promptReferenceGenerateCostCredits: promptReferenceGenerateCostCredits,
        hasSufficientCreditsForCost: hasSufficientCreditsForCost,
        hasSufficientCreditsForPromptReferenceGenerate: hasSufficientCreditsForPromptReferenceGenerate,
        isCreditGuardrail: isCreditGuardrail,
        generationGuardrail: generationGuardrail,
        isGenerateDisabled: isGenerateDisabled,
        modelConfig: modelConfig,
        referenceImageWarning: referenceImageWarning,
    };
};
exports.useAiStudioViewModel = useAiStudioViewModel;
