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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
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
exports.useAiStudioGenerationController = void 0;
/**
 * AI Studio generation controller hook.
 * Owns submission/regeneration orchestration while preserving page behavior.
 */
var react_1 = require("react");
var createCharacterModeModelMapping_1 = require("../logic/createCharacterModeModelMapping");
var generationStartPolicy_1 = require("../logic/generationStartPolicy");
var concurrentGenerationCap_1 = require("../logic/concurrentGenerationCap");
var editPromptPolicy_1 = require("../logic/editPromptPolicy");
var promptAdjacency_1 = require("../logic/promptAdjacency");
var referenceInputs_1 = require("../logic/referenceInputs");
var withDeadline_1 = require("../logic/withDeadline");
var PREFLIGHT_TIMEOUT_ERROR = "Preparation timed out before generation started. Please retry.";
var PREFLIGHT_TIMEOUT_MS = 10000;
var isCreateTool = function (tool) { return tool === "create" || tool === "text"; };
/**
 * Returns stable generation action handlers and click-lock state for AI Studio orchestration.
 */
var useAiStudioGenerationController = function (_a) {
    var mode = _a.mode, selectedTool = _a.selectedTool, model = _a.model, setModel = _a.setModel, isCharacterModeEnabled = _a.isCharacterModeEnabled, resolveIsCharacterModeEnabledForTool = _a.resolveIsCharacterModeEnabledForTool, prompt = _a.prompt, agentInput = _a.agentInput, chatModeEnabled = _a.chatModeEnabled, currentCostCredits = _a.currentCostCredits, _b = _a.promptReferenceGenerateCostCredits, promptReferenceGenerateCostCredits = _b === void 0 ? null : _b, resolveCostCreditsForModel = _a.resolveCostCreditsForModel, _c = _a.activeGenerationCount, activeGenerationCount = _c === void 0 ? 0 : _c, isGenerateDisabled = _a.isGenerateDisabled, isCreditGuardrail = _a.isCreditGuardrail, generationGuardrail = _a.generationGuardrail, effectiveBalanceCredits = _a.effectiveBalanceCredits, balanceCredits = _a.balanceCredits, optimisticUncoveredDebitTotal = _a.optimisticUncoveredDebitTotal, setUiError = _a.setUiError, setUiNotice = _a.setUiNotice, setPromptOrigin = _a.setPromptOrigin, setOptimisticDebitEntries = _a.setOptimisticDebitEntries, refreshBalance = _a.refreshBalance, handleAgentSend = _a.handleAgentSend, addAgentPromptReference = _a.addAgentPromptReference, resolveDefaultPromptForTool = _a.resolveDefaultPromptForTool, refreshCharacterModeInjectionBundleForSubmission = _a.refreshCharacterModeInjectionBundleForSubmission, resolveCharacterModeSubmissionOverrides = _a.resolveCharacterModeSubmissionOverrides, resolveReferenceInputsForTool = _a.resolveReferenceInputsForTool, trackCharacterModeFallback = _a.trackCharacterModeFallback, trackCharacterModeEvent = _a.trackCharacterModeEvent, insertOptimisticGenerationPlaceholder = _a.insertOptimisticGenerationPlaceholder, removeOptimisticGenerationPlaceholder = _a.removeOptimisticGenerationPlaceholder, generateOutput = _a.generateOutput, regenerateOutput = _a.regenerateOutput, activeOutputId = _a.activeOutputId;
    var generateClickLockedRef = (0, react_1.useRef)(false);
    var pendingStartCountRef = (0, react_1.useRef)(0);
    var _d = (0, react_1.useState)(false), isGenerateClickLocked = _d[0], setIsGenerateClickLocked = _d[1];
    (0, react_1.useEffect)(function () {
        pendingStartCountRef.current = 0;
    }, [activeGenerationCount]);
    var tryAcquireGenerateClickLock = (0, react_1.useCallback)(function () {
        if (generateClickLockedRef.current)
            return false;
        generateClickLockedRef.current = true;
        setIsGenerateClickLocked(true);
        return true;
    }, []);
    var releaseGenerateClickLock = (0, react_1.useCallback)(function () {
        generateClickLockedRef.current = false;
        setIsGenerateClickLocked(false);
    }, []);
    var resolveEffectiveActiveGenerationCount = (0, react_1.useCallback)(function () { return activeGenerationCount + pendingStartCountRef.current; }, [activeGenerationCount]);
    var showConcurrentGenerationCapNotice = (0, react_1.useCallback)(function () {
        setUiNotice(concurrentGenerationCap_1.CONCURRENT_GENERATION_CAP_MESSAGE);
    }, [setUiNotice]);
    var resolveGuardrailBlockMessage = (0, react_1.useCallback)(function () { return generationGuardrail !== null && generationGuardrail !== void 0 ? generationGuardrail : generationStartPolicy_1.GENERATION_GUARDRAIL_FALLBACK_ERROR; }, [generationGuardrail]);
    var ensureFreshCreditsForRun = (0, react_1.useCallback)(function (requiredCredits) { return __awaiter(void 0, void 0, void 0, function () {
        var refreshSource, latestBalance, resolvedBalance, shouldApplyOptimisticAdjustment, adjustedBalance;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (requiredCredits == null)
                        return [2 /*return*/, true];
                    refreshSource = null;
                    return [4 /*yield*/, refreshBalance({
                            silent: true,
                            beforeCommit: function (snapshot) {
                                var _a;
                                refreshSource = (_a = snapshot.source) !== null && _a !== void 0 ? _a : null;
                            },
                        })];
                case 1:
                    latestBalance = _a.sent();
                    resolvedBalance = latestBalance !== null && latestBalance !== void 0 ? latestBalance : balanceCredits;
                    if (resolvedBalance == null)
                        return [2 /*return*/, true];
                    shouldApplyOptimisticAdjustment = refreshSource !== "snapshot";
                    adjustedBalance = shouldApplyOptimisticAdjustment
                        ? Math.max(0, resolvedBalance - optimisticUncoveredDebitTotal)
                        : Math.max(0, resolvedBalance);
                    return [2 /*return*/, adjustedBalance >= requiredCredits];
            }
        });
    }); }, [balanceCredits, optimisticUncoveredDebitTotal, refreshBalance]);
    var enqueueOptimisticDebit = (0, react_1.useCallback)(function (credits, outputId) {
        if (outputId === void 0) { outputId = null; }
        if (credits == null || credits <= 0)
            return;
        setOptimisticDebitEntries(function (prev) { return __spreadArray(__spreadArray([], prev, true), [
            {
                credits: credits,
                outputId: outputId,
                createdAtMs: Date.now(),
            },
        ], false); });
    }, [setOptimisticDebitEntries]);
    var resolveEffectiveSubmitModelId = (0, react_1.useCallback)(function (tool) {
        if (!isCreateTool(tool))
            return model;
        var characterModeEnabledForTool = resolveIsCharacterModeEnabledForTool
            ? resolveIsCharacterModeEnabledForTool(tool)
            : isCharacterModeEnabled;
        return (0, createCharacterModeModelMapping_1.resolveCreateCharacterModeSubmitModel)({
            currentModelId: model,
            isCharacterModeEnabled: characterModeEnabledForTool,
        });
    }, [isCharacterModeEnabled, model, resolveIsCharacterModeEnabledForTool]);
    var resolveUserReferenceInputsForTool = (0, react_1.useCallback)(function (tool) {
        if (tool !== "edit" && tool !== "image") {
            return [];
        }
        var _a = resolveReferenceInputsForTool(tool), referenceImageUrl = _a.referenceImageUrl, extraImageUrls = _a.extraImageUrls;
        return (0, referenceInputs_1.buildImageReferenceInputs)(referenceImageUrl, extraImageUrls);
    }, [resolveReferenceInputsForTool]);
    var handleGenerate = (0, react_1.useCallback)(function (promptOverride, options) { return __awaiter(void 0, void 0, void 0, function () {
        var effectiveMode, effectiveTool_1, isCharacterModeEnabledForTool, effectiveModelId, wasSubmitModelCoerced, requiredCredits, checkedFreshCredits, hasFreshCredits, hasFreshCredits, _a, defaultPromptForTool, promptToUse, startDecision, optimisticOutputId, characterModeOverrides, characterModeBundleForSubmit, userReferenceInputs, error_1, hasCharacterModeReferences, characterModeDecision;
        var _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    if (!tryAcquireGenerateClickLock()) {
                        return [2 /*return*/, { accepted: false, optimisticOutputId: null }];
                    }
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, , 13, 14]);
                    effectiveMode = (_b = options === null || options === void 0 ? void 0 : options.modeOverride) !== null && _b !== void 0 ? _b : mode;
                    effectiveTool_1 = (_c = options === null || options === void 0 ? void 0 : options.toolOverride) !== null && _c !== void 0 ? _c : selectedTool;
                    isCharacterModeEnabledForTool = resolveIsCharacterModeEnabledForTool
                        ? resolveIsCharacterModeEnabledForTool(effectiveTool_1)
                        : isCharacterModeEnabled;
                    effectiveModelId = resolveEffectiveSubmitModelId(effectiveTool_1);
                    wasSubmitModelCoerced = effectiveModelId != null && model != null && effectiveModelId !== model;
                    if (wasSubmitModelCoerced) {
                        setModel(effectiveModelId);
                        trackCharacterModeEvent === null || trackCharacterModeEvent === void 0 ? void 0 : trackCharacterModeEvent("character_mode_submit_invariant_coerced", {
                            trigger: "generate",
                            tool: effectiveTool_1,
                            from_model_id: model,
                            to_model_id: effectiveModelId,
                        });
                    }
                    if (resolveEffectiveActiveGenerationCount() >= concurrentGenerationCap_1.MAX_CONCURRENT_GENERATIONS) {
                        showConcurrentGenerationCapNotice();
                        return [2 /*return*/, { accepted: false, optimisticOutputId: null }];
                    }
                    requiredCredits = (_d = options === null || options === void 0 ? void 0 : options.costOverrideCredits) !== null && _d !== void 0 ? _d : currentCostCredits;
                    checkedFreshCredits = false;
                    if (!((options === null || options === void 0 ? void 0 : options.costOverrideCredits) != null &&
                        effectiveBalanceCredits != null &&
                        effectiveBalanceCredits < options.costOverrideCredits)) return [3 /*break*/, 3];
                    return [4 /*yield*/, ensureFreshCreditsForRun(options.costOverrideCredits)];
                case 2:
                    hasFreshCredits = _g.sent();
                    checkedFreshCredits = true;
                    if (!hasFreshCredits) {
                        setUiError("You do not have enough credits for this run.");
                        return [2 /*return*/, { accepted: false, optimisticOutputId: null }];
                    }
                    _g.label = 3;
                case 3:
                    if (!isGenerateDisabled) return [3 /*break*/, 8];
                    if (generationGuardrail === concurrentGenerationCap_1.CONCURRENT_GENERATION_CAP_MESSAGE) {
                        showConcurrentGenerationCapNotice();
                        return [2 /*return*/, { accepted: false, optimisticOutputId: null }];
                    }
                    if (!isCreditGuardrail) return [3 /*break*/, 7];
                    if (!checkedFreshCredits) return [3 /*break*/, 4];
                    _a = true;
                    return [3 /*break*/, 6];
                case 4: return [4 /*yield*/, ensureFreshCreditsForRun(requiredCredits)];
                case 5:
                    _a = _g.sent();
                    _g.label = 6;
                case 6:
                    hasFreshCredits = _a;
                    if (!hasFreshCredits) {
                        setUiError(resolveGuardrailBlockMessage());
                        return [2 /*return*/, { accepted: false, optimisticOutputId: null }];
                    }
                    return [3 /*break*/, 8];
                case 7:
                    setUiError(resolveGuardrailBlockMessage());
                    return [2 /*return*/, { accepted: false, optimisticOutputId: null }];
                case 8:
                    defaultPromptForTool = resolveDefaultPromptForTool(effectiveTool_1);
                    promptToUse = typeof promptOverride === "string" ? promptOverride : defaultPromptForTool;
                    startDecision = (0, generationStartPolicy_1.resolveGenerationStartDecision)({
                        tool: effectiveTool_1,
                        mode: effectiveMode,
                        modelId: effectiveModelId,
                        promptText: promptToUse,
                        checkPrompt: (0, editPromptPolicy_1.shouldCheckPromptAtGenerationStart)({
                            tool: effectiveTool_1,
                            modelId: effectiveModelId,
                        }),
                    });
                    if (!startDecision.allow) {
                        setUiError(startDecision.message);
                        return [2 /*return*/, { accepted: false, optimisticOutputId: null }];
                    }
                    pendingStartCountRef.current += 1;
                    optimisticOutputId = insertOptimisticGenerationPlaceholder === null || insertOptimisticGenerationPlaceholder === void 0 ? void 0 : insertOptimisticGenerationPlaceholder({
                        prompt: promptToUse,
                        modeOverride: effectiveMode,
                        selectedToolOverride: effectiveTool_1,
                    });
                    characterModeOverrides = void 0;
                    _g.label = 9;
                case 9:
                    _g.trys.push([9, 11, , 12]);
                    trackCharacterModeEvent === null || trackCharacterModeEvent === void 0 ? void 0 : trackCharacterModeEvent("generation_preflight_started", {
                        trigger: "generate",
                        tool: effectiveTool_1,
                        model_id: effectiveModelId,
                        is_character_mode: isCharacterModeEnabledForTool,
                    });
                    return [4 /*yield*/, (0, withDeadline_1.withDeadline)({
                            timeoutMs: PREFLIGHT_TIMEOUT_MS,
                            timeoutMessage: PREFLIGHT_TIMEOUT_ERROR,
                            run: function () { return refreshCharacterModeInjectionBundleForSubmission(effectiveTool_1); },
                        })];
                case 10:
                    characterModeBundleForSubmit = _g.sent();
                    userReferenceInputs = resolveUserReferenceInputsForTool(effectiveTool_1);
                    characterModeOverrides = resolveCharacterModeSubmissionOverrides(promptToUse, effectiveTool_1, characterModeBundleForSubmit, userReferenceInputs);
                    return [3 /*break*/, 12];
                case 11:
                    error_1 = _g.sent();
                    pendingStartCountRef.current = Math.max(0, pendingStartCountRef.current - 1);
                    if (error_1 instanceof withDeadline_1.DeadlineExceededError) {
                        trackCharacterModeEvent === null || trackCharacterModeEvent === void 0 ? void 0 : trackCharacterModeEvent("generation_preflight_timeout", {
                            trigger: "generate",
                            tool: effectiveTool_1,
                            model_id: effectiveModelId,
                            is_character_mode: isCharacterModeEnabledForTool,
                            duration_ms: error_1.timeoutMs,
                            reason_code: "PREFLIGHT_TIMEOUT",
                        });
                    }
                    if (optimisticOutputId) {
                        removeOptimisticGenerationPlaceholder === null || removeOptimisticGenerationPlaceholder === void 0 ? void 0 : removeOptimisticGenerationPlaceholder(optimisticOutputId);
                    }
                    setUiError(error_1 instanceof withDeadline_1.DeadlineExceededError
                        ? PREFLIGHT_TIMEOUT_ERROR
                        : error_1 instanceof Error
                            ? error_1.message
                            : "Unable to start generation.");
                    return [2 /*return*/, { accepted: false, optimisticOutputId: null }];
                case 12:
                    hasCharacterModeReferences = ((_f = (_e = characterModeOverrides === null || characterModeOverrides === void 0 ? void 0 : characterModeOverrides.referenceInputsOverride) === null || _e === void 0 ? void 0 : _e.length) !== null && _f !== void 0 ? _f : 0) > 0;
                    characterModeDecision = characterModeOverrides &&
                        (0, generationStartPolicy_1.resolveGenerationStartDecision)({
                            tool: effectiveTool_1,
                            mode: effectiveMode,
                            modelId: effectiveModelId,
                            promptText: promptToUse,
                            checkCreateTextMode: false,
                            checkPrompt: false,
                            checkModel: false,
                            checkCharacterReferences: true,
                            hasCharacterModeReferences: hasCharacterModeReferences,
                        });
                    if (characterModeOverrides && characterModeDecision && !characterModeDecision.allow) {
                        pendingStartCountRef.current = Math.max(0, pendingStartCountRef.current - 1);
                        trackCharacterModeFallback(characterModeOverrides, effectiveTool_1);
                        trackCharacterModeEvent === null || trackCharacterModeEvent === void 0 ? void 0 : trackCharacterModeEvent("character_mode_submit_blocked_no_references", {
                            tool: effectiveTool_1,
                            fallback_code: characterModeOverrides.fallbackCode,
                            has_character_description: characterModeOverrides.hasCharacterDescription,
                            character_reference_count: characterModeOverrides.characterReferenceCount,
                        });
                        if (optimisticOutputId) {
                            removeOptimisticGenerationPlaceholder === null || removeOptimisticGenerationPlaceholder === void 0 ? void 0 : removeOptimisticGenerationPlaceholder(optimisticOutputId);
                        }
                        setUiError(characterModeDecision.message);
                        return [2 /*return*/, { accepted: false, optimisticOutputId: null }];
                    }
                    trackCharacterModeFallback(characterModeOverrides, effectiveTool_1);
                    enqueueOptimisticDebit(requiredCredits, optimisticOutputId !== null && optimisticOutputId !== void 0 ? optimisticOutputId : null);
                    generateOutput(promptToUse, __assign(__assign({ modeOverride: effectiveMode, selectedToolOverride: effectiveTool_1, modelIdOverride: effectiveModelId, submissionPromptOverride: characterModeOverrides === null || characterModeOverrides === void 0 ? void 0 : characterModeOverrides.submissionPromptOverride, displayPromptOverride: characterModeOverrides === null || characterModeOverrides === void 0 ? void 0 : characterModeOverrides.displayPromptOverride, referenceInputsOverride: characterModeOverrides === null || characterModeOverrides === void 0 ? void 0 : characterModeOverrides.referenceInputsOverride }, (optimisticOutputId ? { outputIdOverride: optimisticOutputId } : {})), ((characterModeOverrides === null || characterModeOverrides === void 0 ? void 0 : characterModeOverrides.characterContextOverride)
                        ? { characterContextOverride: characterModeOverrides.characterContextOverride }
                        : {})));
                    if (characterModeOverrides === null || characterModeOverrides === void 0 ? void 0 : characterModeOverrides.notice) {
                        setUiNotice(characterModeOverrides.notice);
                    }
                    return [2 /*return*/, {
                            accepted: true,
                            optimisticOutputId: optimisticOutputId !== null && optimisticOutputId !== void 0 ? optimisticOutputId : null,
                        }];
                case 13:
                    releaseGenerateClickLock();
                    return [7 /*endfinally*/];
                case 14: return [2 /*return*/];
            }
        });
    }); }, [
        activeGenerationCount,
        currentCostCredits,
        effectiveBalanceCredits,
        enqueueOptimisticDebit,
        ensureFreshCreditsForRun,
        generateOutput,
        isCreditGuardrail,
        isCharacterModeEnabled,
        isGenerateDisabled,
        insertOptimisticGenerationPlaceholder,
        mode,
        model,
        removeOptimisticGenerationPlaceholder,
        refreshCharacterModeInjectionBundleForSubmission,
        releaseGenerateClickLock,
        resolveGuardrailBlockMessage,
        resolveEffectiveActiveGenerationCount,
        resolveEffectiveSubmitModelId,
        resolveCharacterModeSubmissionOverrides,
        resolveDefaultPromptForTool,
        resolveUserReferenceInputsForTool,
        resolveIsCharacterModeEnabledForTool,
        selectedTool,
        setModel,
        setUiError,
        setUiNotice,
        showConcurrentGenerationCapNotice,
        trackCharacterModeFallback,
        trackCharacterModeEvent,
        tryAcquireGenerateClickLock,
    ]);
    var handlePrimarySubmit = (0, react_1.useCallback)(function () {
        if ((selectedTool === "create" || selectedTool === "text") && mode === "text") {
            if (chatModeEnabled) {
                handleAgentSend(agentInput || prompt, { captureResult: true }).then(function (result) {
                    var agentRes = result;
                    if (agentRes === null || agentRes === void 0 ? void 0 : agentRes.prompt) {
                        addAgentPromptReference(agentRes.prompt, agentRes.referenceTitle);
                        setPromptOrigin("agent");
                    }
                });
            }
            else {
                var rawPrompt = (0, promptAdjacency_1.resolveChatOffCreatePrompt)({
                    agentInput: agentInput,
                    sharedPrompt: prompt,
                    allowSharedPromptFallback: true,
                });
                if (rawPrompt) {
                    setPromptOrigin("manual");
                }
                void handleGenerate(rawPrompt !== null && rawPrompt !== void 0 ? rawPrompt : "", {
                    modeOverride: "image",
                    toolOverride: "create",
                    costOverrideCredits: promptReferenceGenerateCostCredits !== null && promptReferenceGenerateCostCredits !== void 0 ? promptReferenceGenerateCostCredits : currentCostCredits,
                });
            }
            return;
        }
        void handleGenerate();
    }, [
        addAgentPromptReference,
        agentInput,
        chatModeEnabled,
        currentCostCredits,
        handleAgentSend,
        handleGenerate,
        mode,
        prompt,
        promptReferenceGenerateCostCredits,
        selectedTool,
        setPromptOrigin,
    ]);
    var handleChatOffInlineGenerate = (0, react_1.useCallback)(function () {
        var rawPrompt = (0, promptAdjacency_1.resolveChatOffCreatePrompt)({
            agentInput: agentInput,
            sharedPrompt: prompt,
            allowSharedPromptFallback: true,
        });
        if (rawPrompt)
            setPromptOrigin("manual");
        void handleGenerate(rawPrompt !== null && rawPrompt !== void 0 ? rawPrompt : "", {
            modeOverride: "image",
            toolOverride: "create",
            costOverrideCredits: promptReferenceGenerateCostCredits !== null && promptReferenceGenerateCostCredits !== void 0 ? promptReferenceGenerateCostCredits : currentCostCredits,
        });
    }, [
        agentInput,
        currentCostCredits,
        handleGenerate,
        prompt,
        promptReferenceGenerateCostCredits,
        setPromptOrigin,
    ]);
    var runRegenerateWithDebit = (0, react_1.useCallback)(function (options) { return __awaiter(void 0, void 0, void 0, function () {
        var effectiveSubmitModelId, isCharacterModeEnabledForTool, hasSubmitModelOverride, resolvedModelOverrideCredits, resolvedRunCostCredits, requiredCredits, checkedFreshCredits, hasFreshCredits, hasFreshCredits, _a, promptToUse, promptForGuardrails, promptForCharacterComposition, regenerateStartDecision, characterModeOverrides, characterModeBundleForSubmit, userReferenceInputs, error_2, hasCharacterModeReferences, regenerateCharacterModeDecision, effectiveModelId, wasSubmitModelCoerced, shouldPersistSubmitModelCoercion, resolvedDisplayPromptOverride, resolvedSubmissionPromptOverride;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        return __generator(this, function (_p) {
            switch (_p.label) {
                case 0:
                    if (!tryAcquireGenerateClickLock())
                        return [2 /*return*/];
                    _p.label = 1;
                case 1:
                    _p.trys.push([1, , 12, 13]);
                    effectiveSubmitModelId = (_d = (_c = (_b = options === null || options === void 0 ? void 0 : options.inpaintOverride) === null || _b === void 0 ? void 0 : _b.modelId) !== null && _c !== void 0 ? _c : options === null || options === void 0 ? void 0 : options.modelIdOverride) !== null && _d !== void 0 ? _d : resolveEffectiveSubmitModelId(selectedTool);
                    isCharacterModeEnabledForTool = resolveIsCharacterModeEnabledForTool
                        ? resolveIsCharacterModeEnabledForTool(selectedTool)
                        : isCharacterModeEnabled;
                    hasSubmitModelOverride = Boolean((_f = (_e = options === null || options === void 0 ? void 0 : options.inpaintOverride) === null || _e === void 0 ? void 0 : _e.modelId) !== null && _f !== void 0 ? _f : options === null || options === void 0 ? void 0 : options.modelIdOverride);
                    resolvedModelOverrideCredits = hasSubmitModelOverride && effectiveSubmitModelId
                        ? ((_g = resolveCostCreditsForModel === null || resolveCostCreditsForModel === void 0 ? void 0 : resolveCostCreditsForModel(effectiveSubmitModelId)) !== null && _g !== void 0 ? _g : null)
                        : null;
                    resolvedRunCostCredits = (_h = options === null || options === void 0 ? void 0 : options.costOverrideCredits) !== null && _h !== void 0 ? _h : resolvedModelOverrideCredits;
                    requiredCredits = resolvedRunCostCredits !== null && resolvedRunCostCredits !== void 0 ? resolvedRunCostCredits : currentCostCredits;
                    checkedFreshCredits = false;
                    if (resolveEffectiveActiveGenerationCount() >= concurrentGenerationCap_1.MAX_CONCURRENT_GENERATIONS) {
                        showConcurrentGenerationCapNotice();
                        return [2 /*return*/];
                    }
                    if (!(resolvedRunCostCredits != null &&
                        effectiveBalanceCredits != null &&
                        effectiveBalanceCredits < resolvedRunCostCredits)) return [3 /*break*/, 3];
                    return [4 /*yield*/, ensureFreshCreditsForRun(resolvedRunCostCredits)];
                case 2:
                    hasFreshCredits = _p.sent();
                    checkedFreshCredits = true;
                    if (!hasFreshCredits) {
                        setUiError("You do not have enough credits for this run.");
                        return [2 /*return*/];
                    }
                    _p.label = 3;
                case 3:
                    if (isGenerateDisabled && !isCreditGuardrail) {
                        if (generationGuardrail === concurrentGenerationCap_1.CONCURRENT_GENERATION_CAP_MESSAGE) {
                            showConcurrentGenerationCapNotice();
                            return [2 /*return*/];
                        }
                        setUiError(resolveGuardrailBlockMessage());
                        return [2 /*return*/];
                    }
                    if (!isCreditGuardrail) return [3 /*break*/, 7];
                    if (!checkedFreshCredits) return [3 /*break*/, 4];
                    _a = true;
                    return [3 /*break*/, 6];
                case 4: return [4 /*yield*/, ensureFreshCreditsForRun(requiredCredits)];
                case 5:
                    _a = _p.sent();
                    _p.label = 6;
                case 6:
                    hasFreshCredits = _a;
                    if (!hasFreshCredits) {
                        setUiError(resolveGuardrailBlockMessage());
                        return [2 /*return*/];
                    }
                    _p.label = 7;
                case 7:
                    promptToUse = resolveDefaultPromptForTool(selectedTool);
                    promptForGuardrails = typeof (options === null || options === void 0 ? void 0 : options.displayPromptOverride) === "string"
                        ? options.displayPromptOverride
                        : promptToUse;
                    promptForCharacterComposition = typeof (options === null || options === void 0 ? void 0 : options.submissionPromptOverride) === "string"
                        ? options.submissionPromptOverride
                        : promptForGuardrails;
                    regenerateStartDecision = (0, generationStartPolicy_1.resolveGenerationStartDecision)({
                        tool: selectedTool,
                        mode: mode,
                        modelId: effectiveSubmitModelId,
                        promptText: promptForGuardrails,
                        checkCreateTextMode: false,
                        checkPrompt: (0, editPromptPolicy_1.shouldCheckPromptAtGenerationStart)({
                            tool: selectedTool,
                            modelId: effectiveSubmitModelId,
                        }),
                    });
                    if (!regenerateStartDecision.allow) {
                        setUiError(regenerateStartDecision.message);
                        return [2 /*return*/];
                    }
                    characterModeOverrides = void 0;
                    _p.label = 8;
                case 8:
                    _p.trys.push([8, 10, , 11]);
                    trackCharacterModeEvent === null || trackCharacterModeEvent === void 0 ? void 0 : trackCharacterModeEvent("generation_preflight_started", {
                        trigger: "regenerate",
                        tool: selectedTool,
                        model_id: effectiveSubmitModelId,
                        is_character_mode: isCharacterModeEnabledForTool,
                    });
                    return [4 /*yield*/, (0, withDeadline_1.withDeadline)({
                            timeoutMs: PREFLIGHT_TIMEOUT_MS,
                            timeoutMessage: PREFLIGHT_TIMEOUT_ERROR,
                            run: function () { return refreshCharacterModeInjectionBundleForSubmission(selectedTool); },
                        })];
                case 9:
                    characterModeBundleForSubmit = _p.sent();
                    userReferenceInputs = (_j = options === null || options === void 0 ? void 0 : options.referenceInputsOverride) !== null && _j !== void 0 ? _j : resolveUserReferenceInputsForTool(selectedTool);
                    characterModeOverrides = resolveCharacterModeSubmissionOverrides(promptForCharacterComposition, selectedTool, characterModeBundleForSubmit, userReferenceInputs);
                    return [3 /*break*/, 11];
                case 10:
                    error_2 = _p.sent();
                    if (error_2 instanceof withDeadline_1.DeadlineExceededError) {
                        trackCharacterModeEvent === null || trackCharacterModeEvent === void 0 ? void 0 : trackCharacterModeEvent("generation_preflight_timeout", {
                            trigger: "regenerate",
                            tool: selectedTool,
                            model_id: effectiveSubmitModelId,
                            is_character_mode: isCharacterModeEnabledForTool,
                            duration_ms: error_2.timeoutMs,
                            reason_code: "PREFLIGHT_TIMEOUT",
                        });
                    }
                    setUiError(error_2 instanceof withDeadline_1.DeadlineExceededError
                        ? PREFLIGHT_TIMEOUT_ERROR
                        : error_2 instanceof Error
                            ? error_2.message
                            : "Unable to start generation.");
                    return [2 /*return*/];
                case 11:
                    hasCharacterModeReferences = ((_l = (_k = characterModeOverrides === null || characterModeOverrides === void 0 ? void 0 : characterModeOverrides.referenceInputsOverride) === null || _k === void 0 ? void 0 : _k.length) !== null && _l !== void 0 ? _l : 0) > 0;
                    regenerateCharacterModeDecision = characterModeOverrides &&
                        (0, generationStartPolicy_1.resolveGenerationStartDecision)({
                            tool: selectedTool,
                            mode: mode,
                            modelId: effectiveSubmitModelId,
                            promptText: promptForGuardrails,
                            checkCreateTextMode: false,
                            checkPrompt: false,
                            checkModel: false,
                            checkCharacterReferences: true,
                            hasCharacterModeReferences: hasCharacterModeReferences,
                        });
                    if (characterModeOverrides &&
                        regenerateCharacterModeDecision &&
                        !regenerateCharacterModeDecision.allow) {
                        trackCharacterModeFallback(characterModeOverrides, selectedTool);
                        trackCharacterModeEvent === null || trackCharacterModeEvent === void 0 ? void 0 : trackCharacterModeEvent("character_mode_submit_blocked_no_references", {
                            tool: selectedTool,
                            fallback_code: characterModeOverrides.fallbackCode,
                            has_character_description: characterModeOverrides.hasCharacterDescription,
                            character_reference_count: characterModeOverrides.characterReferenceCount,
                        });
                        setUiError(regenerateCharacterModeDecision.message);
                        return [2 /*return*/];
                    }
                    trackCharacterModeFallback(characterModeOverrides, selectedTool);
                    effectiveModelId = effectiveSubmitModelId;
                    wasSubmitModelCoerced = effectiveModelId != null && model != null && effectiveModelId !== model;
                    shouldPersistSubmitModelCoercion = wasSubmitModelCoerced && !hasSubmitModelOverride;
                    if (shouldPersistSubmitModelCoercion) {
                        setModel(effectiveModelId);
                        trackCharacterModeEvent === null || trackCharacterModeEvent === void 0 ? void 0 : trackCharacterModeEvent("character_mode_submit_invariant_coerced", {
                            trigger: "regenerate",
                            tool: selectedTool,
                            from_model_id: model,
                            to_model_id: effectiveModelId,
                        });
                    }
                    pendingStartCountRef.current += 1;
                    enqueueOptimisticDebit(requiredCredits, activeOutputId !== null && activeOutputId !== void 0 ? activeOutputId : null);
                    resolvedDisplayPromptOverride = typeof (options === null || options === void 0 ? void 0 : options.displayPromptOverride) === "string"
                        ? options.displayPromptOverride
                        : characterModeOverrides === null || characterModeOverrides === void 0 ? void 0 : characterModeOverrides.displayPromptOverride;
                    resolvedSubmissionPromptOverride = (_m = characterModeOverrides === null || characterModeOverrides === void 0 ? void 0 : characterModeOverrides.submissionPromptOverride) !== null && _m !== void 0 ? _m : options === null || options === void 0 ? void 0 : options.submissionPromptOverride;
                    regenerateOutput(__assign(__assign(__assign({ modelIdOverride: effectiveModelId, submissionPromptOverride: resolvedSubmissionPromptOverride, displayPromptOverride: resolvedDisplayPromptOverride, referenceInputsOverride: (_o = characterModeOverrides === null || characterModeOverrides === void 0 ? void 0 : characterModeOverrides.referenceInputsOverride) !== null && _o !== void 0 ? _o : options === null || options === void 0 ? void 0 : options.referenceInputsOverride, inpaintOverride: options === null || options === void 0 ? void 0 : options.inpaintOverride, hideOutputFromReferenceGrid: options === null || options === void 0 ? void 0 : options.hideOutputFromReferenceGrid }, ((options === null || options === void 0 ? void 0 : options.referenceInputsMode)
                        ? { referenceInputsMode: options.referenceInputsMode }
                        : {})), ((options === null || options === void 0 ? void 0 : options.styleContextOverride)
                        ? { styleContextOverride: options.styleContextOverride }
                        : {})), ((characterModeOverrides === null || characterModeOverrides === void 0 ? void 0 : characterModeOverrides.characterContextOverride)
                        ? { characterContextOverride: characterModeOverrides.characterContextOverride }
                        : {})));
                    if (characterModeOverrides === null || characterModeOverrides === void 0 ? void 0 : characterModeOverrides.notice) {
                        setUiNotice(characterModeOverrides.notice);
                    }
                    return [3 /*break*/, 13];
                case 12:
                    releaseGenerateClickLock();
                    return [7 /*endfinally*/];
                case 13: return [2 /*return*/];
            }
        });
    }); }, [
        activeOutputId,
        activeGenerationCount,
        currentCostCredits,
        effectiveBalanceCredits,
        enqueueOptimisticDebit,
        ensureFreshCreditsForRun,
        isCreditGuardrail,
        isGenerateDisabled,
        generationGuardrail,
        mode,
        model,
        isCharacterModeEnabled,
        resolveIsCharacterModeEnabledForTool,
        refreshCharacterModeInjectionBundleForSubmission,
        regenerateOutput,
        releaseGenerateClickLock,
        resolveGuardrailBlockMessage,
        resolveEffectiveActiveGenerationCount,
        resolveEffectiveSubmitModelId,
        resolveCharacterModeSubmissionOverrides,
        resolveDefaultPromptForTool,
        resolveCostCreditsForModel,
        resolveUserReferenceInputsForTool,
        selectedTool,
        setModel,
        setUiError,
        setUiNotice,
        showConcurrentGenerationCapNotice,
        trackCharacterModeFallback,
        trackCharacterModeEvent,
        tryAcquireGenerateClickLock,
    ]);
    var handleRegenerateWithDebit = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runRegenerateWithDebit()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [runRegenerateWithDebit]);
    var handleImageRegenerateWithDebit = (0, react_1.useCallback)(function (options) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runRegenerateWithDebit(options)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [runRegenerateWithDebit]);
    return {
        isGenerateClickLocked: isGenerateClickLocked,
        handleGenerate: handleGenerate,
        handlePrimarySubmit: handlePrimarySubmit,
        handleChatOffInlineGenerate: handleChatOffInlineGenerate,
        handleRegenerateWithDebit: handleRegenerateWithDebit,
        handleImageRegenerateWithDebit: handleImageRegenerateWithDebit,
    };
};
exports.useAiStudioGenerationController = useAiStudioGenerationController;
