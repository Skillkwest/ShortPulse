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
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("@testing-library/react");
var vitest_1 = require("vitest");
var concurrentGenerationCap_1 = require("../../logic/concurrentGenerationCap");
var inpaintSubmission_1 = require("../../logic/inpaintSubmission");
var useAiStudioGenerationController_1 = require("../useAiStudioGenerationController");
var asDispatch = function (fn) {
    return fn;
};
var createParams = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (__assign({ mode: "image", selectedTool: "create", model: "fal-ai/bytedance/seedream/v4.5/text-to-image", setModel: vitest_1.vi.fn(), isCharacterModeEnabled: false, prompt: "", agentInput: "", agentBusy: false, chatModeEnabled: true, currentCostCredits: 3, resolveCostCreditsForModel: vitest_1.vi.fn(function () { return null; }), isGenerateDisabled: false, isCreditGuardrail: false, generationGuardrail: null, effectiveBalanceCredits: 100, balanceCredits: 100, optimisticUncoveredDebitTotal: 0, setUiError: asDispatch(vitest_1.vi.fn()), setUiNotice: asDispatch(vitest_1.vi.fn()), setPromptOrigin: asDispatch(vitest_1.vi.fn()), setOptimisticDebitEntries: asDispatch(vitest_1.vi.fn()), refreshBalance: vitest_1.vi.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, 100];
        }); }); }), handleAgentSend: vitest_1.vi.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, ({ prompt: "agent prompt", referenceTitle: "Agent ref" })];
        }); }); }), addAgentPromptReference: vitest_1.vi.fn(), resolveDefaultPromptForTool: vitest_1.vi.fn(function () { return "default prompt"; }), refreshCharacterModeInjectionBundleForSubmission: vitest_1.vi.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, null];
        }); }); }), resolveCharacterModeSubmissionOverrides: vitest_1.vi.fn(function () { return null; }), resolveReferenceInputsForTool: vitest_1.vi.fn(function () { return ({
            referenceImageUrl: "https://example.com/reference.png",
            extraImageUrls: [null, null, null],
        }); }), trackCharacterModeFallback: vitest_1.vi.fn(), generateOutput: vitest_1.vi.fn(), regenerateOutput: vitest_1.vi.fn() }, overrides));
};
(0, vitest_1.describe)("useAiStudioGenerationController", function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)("routes primary text create submit through agent send and applies returned prompt origin", function () { return __awaiter(void 0, void 0, void 0, function () {
        var handleAgentSend, addAgentPromptReference, setPromptOrigin, generateOutput, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    handleAgentSend = vitest_1.vi.fn(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, ({
                                    prompt: "refined from agent",
                                    referenceTitle: "Refined",
                                })];
                        });
                    }); });
                    addAgentPromptReference = vitest_1.vi.fn();
                    setPromptOrigin = vitest_1.vi.fn();
                    generateOutput = vitest_1.vi.fn();
                    params = createParams({
                        mode: "text",
                        selectedTool: "create",
                        prompt: "draft prompt",
                        handleAgentSend: handleAgentSend,
                        addAgentPromptReference: addAgentPromptReference,
                        setPromptOrigin: asDispatch(setPromptOrigin),
                        generateOutput: generateOutput,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    (0, react_1.act)(function () {
                        result.current.handlePrimarySubmit();
                    });
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, Promise.resolve()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(handleAgentSend).toHaveBeenCalledWith("draft prompt", { captureResult: true });
                    (0, vitest_1.expect)(addAgentPromptReference).toHaveBeenCalledWith("refined from agent", "Refined");
                    (0, vitest_1.expect)(setPromptOrigin).toHaveBeenCalledWith("agent");
                    (0, vitest_1.expect)(generateOutput).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("routes chat-off primary text create submit into create image generation", function () { return __awaiter(void 0, void 0, void 0, function () {
        var handleAgentSend, generateOutput, setPromptOrigin, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    handleAgentSend = vitest_1.vi.fn(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, ({
                                    prompt: "agent prompt should not be used",
                                    referenceTitle: "unused",
                                })];
                        });
                    }); });
                    generateOutput = vitest_1.vi.fn();
                    setPromptOrigin = vitest_1.vi.fn();
                    params = createParams({
                        mode: "text",
                        selectedTool: "create",
                        prompt: "shared fallback",
                        agentInput: "raw composer prompt",
                        chatModeEnabled: false,
                        handleAgentSend: handleAgentSend,
                        generateOutput: generateOutput,
                        setPromptOrigin: asDispatch(setPromptOrigin),
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    (0, react_1.act)(function () {
                        result.current.handlePrimarySubmit();
                    });
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, Promise.resolve()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(handleAgentSend).not.toHaveBeenCalled();
                    (0, vitest_1.expect)(setPromptOrigin).toHaveBeenCalledWith("manual");
                    (0, vitest_1.expect)(generateOutput).toHaveBeenCalledWith("raw composer prompt", vitest_1.expect.objectContaining({
                        modeOverride: "image",
                        selectedToolOverride: "create",
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("falls back to shared prompt for chat-off primary submit when composer input is empty", function () { return __awaiter(void 0, void 0, void 0, function () {
        var handleAgentSend, generateOutput, setPromptOrigin, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    handleAgentSend = vitest_1.vi.fn(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, ({
                                    prompt: "agent prompt should not be used",
                                    referenceTitle: "unused",
                                })];
                        });
                    }); });
                    generateOutput = vitest_1.vi.fn();
                    setPromptOrigin = vitest_1.vi.fn();
                    params = createParams({
                        mode: "text",
                        selectedTool: "create",
                        prompt: "  shared fallback prompt  ",
                        agentInput: "   ",
                        chatModeEnabled: false,
                        handleAgentSend: handleAgentSend,
                        generateOutput: generateOutput,
                        setPromptOrigin: asDispatch(setPromptOrigin),
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    (0, react_1.act)(function () {
                        result.current.handlePrimarySubmit();
                    });
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, Promise.resolve()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(handleAgentSend).not.toHaveBeenCalled();
                    (0, vitest_1.expect)(setPromptOrigin).toHaveBeenCalledWith("manual");
                    (0, vitest_1.expect)(generateOutput).toHaveBeenCalledWith("shared fallback prompt", vitest_1.expect.objectContaining({
                        modeOverride: "image",
                        selectedToolOverride: "create",
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("uses chat-off inline generate to submit trimmed raw input to create image generation", function () { return __awaiter(void 0, void 0, void 0, function () {
        var handleAgentSend, generateOutput, setPromptOrigin, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    handleAgentSend = vitest_1.vi.fn(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, ({
                                    prompt: "agent prompt should not be used",
                                    referenceTitle: "unused",
                                })];
                        });
                    }); });
                    generateOutput = vitest_1.vi.fn();
                    setPromptOrigin = vitest_1.vi.fn();
                    params = createParams({
                        mode: "text",
                        selectedTool: "create",
                        prompt: "shared fallback prompt",
                        agentInput: "  raw inline prompt  ",
                        chatModeEnabled: false,
                        handleAgentSend: handleAgentSend,
                        generateOutput: generateOutput,
                        setPromptOrigin: asDispatch(setPromptOrigin),
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    (0, react_1.act)(function () {
                        result.current.handleChatOffInlineGenerate();
                    });
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, Promise.resolve()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(handleAgentSend).not.toHaveBeenCalled();
                    (0, vitest_1.expect)(setPromptOrigin).toHaveBeenCalledWith("manual");
                    (0, vitest_1.expect)(generateOutput).toHaveBeenCalledWith("raw inline prompt", vitest_1.expect.objectContaining({
                        modeOverride: "image",
                        selectedToolOverride: "create",
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("falls back to shared prompt for chat-off inline generate when input is empty", function () { return __awaiter(void 0, void 0, void 0, function () {
        var handleAgentSend, generateOutput, setPromptOrigin, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    handleAgentSend = vitest_1.vi.fn(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, ({
                                    prompt: "agent prompt should not be used",
                                    referenceTitle: "unused",
                                })];
                        });
                    }); });
                    generateOutput = vitest_1.vi.fn();
                    setPromptOrigin = vitest_1.vi.fn();
                    params = createParams({
                        mode: "text",
                        selectedTool: "create",
                        prompt: "shared fallback prompt",
                        agentInput: "   ",
                        chatModeEnabled: false,
                        handleAgentSend: handleAgentSend,
                        generateOutput: generateOutput,
                        setPromptOrigin: asDispatch(setPromptOrigin),
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    (0, react_1.act)(function () {
                        result.current.handleChatOffInlineGenerate();
                    });
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, Promise.resolve()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(handleAgentSend).not.toHaveBeenCalled();
                    (0, vitest_1.expect)(setPromptOrigin).toHaveBeenCalledWith("manual");
                    (0, vitest_1.expect)(generateOutput).toHaveBeenCalledWith("shared fallback prompt", vitest_1.expect.objectContaining({
                        modeOverride: "image",
                        selectedToolOverride: "create",
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("creates optimistic debits for chat-off primary submit because it routes into generation", function () { return __awaiter(void 0, void 0, void 0, function () {
        var setOptimisticDebitEntries, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setOptimisticDebitEntries = vitest_1.vi.fn();
                    params = createParams({
                        mode: "text",
                        selectedTool: "create",
                        prompt: "shared fallback",
                        agentInput: "raw prompt",
                        chatModeEnabled: false,
                        currentCostCredits: 3,
                        setOptimisticDebitEntries: asDispatch(setOptimisticDebitEntries),
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    (0, react_1.act)(function () {
                        result.current.handlePrimarySubmit();
                    });
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, Promise.resolve()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(setOptimisticDebitEntries).toHaveBeenCalledTimes(1);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("creates optimistic debits for chat-off inline generate because it routes into generation", function () { return __awaiter(void 0, void 0, void 0, function () {
        var setOptimisticDebitEntries, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setOptimisticDebitEntries = vitest_1.vi.fn();
                    params = createParams({
                        mode: "text",
                        selectedTool: "create",
                        prompt: "shared fallback",
                        agentInput: "raw prompt",
                        chatModeEnabled: false,
                        currentCostCredits: 3,
                        setOptimisticDebitEntries: asDispatch(setOptimisticDebitEntries),
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    (0, react_1.act)(function () {
                        result.current.handleChatOffInlineGenerate();
                    });
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, Promise.resolve()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(setOptimisticDebitEntries).toHaveBeenCalledTimes(1);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("shows explicit error when chat-off inline generate has no prompt input", function () { return __awaiter(void 0, void 0, void 0, function () {
        var setUiError, generateOutput, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setUiError = vitest_1.vi.fn();
                    generateOutput = vitest_1.vi.fn();
                    params = createParams({
                        mode: "text",
                        selectedTool: "create",
                        prompt: "   ",
                        agentInput: "   ",
                        chatModeEnabled: false,
                        setUiError: asDispatch(setUiError),
                        generateOutput: generateOutput,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    (0, react_1.act)(function () {
                        result.current.handleChatOffInlineGenerate();
                    });
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, Promise.resolve()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(setUiError).toHaveBeenCalledWith("Add a prompt to start a generation.");
                    (0, vitest_1.expect)(generateOutput).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("blocks overlapping generate submissions while a prior submit is still in flight", function () { return __awaiter(void 0, void 0, void 0, function () {
        var releasePreflight, refreshCharacterModeInjectionBundleForSubmission, generateOutput, params, result, firstResult, secondResult, firstSubmission;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    releasePreflight = null;
                    refreshCharacterModeInjectionBundleForSubmission = vitest_1.vi.fn(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, new Promise(function (resolve) {
                                        releasePreflight = function () { return resolve(null); };
                                    })];
                                case 1: return [2 /*return*/, _a.sent()];
                            }
                        });
                    }); });
                    generateOutput = vitest_1.vi.fn();
                    params = createParams({
                        generateOutput: generateOutput,
                        refreshCharacterModeInjectionBundleForSubmission: refreshCharacterModeInjectionBundleForSubmission,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    firstResult = null;
                    secondResult = null;
                    firstSubmission = (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, result.current.handleGenerate("prompt")];
                                case 1:
                                    firstResult = _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); });
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, Promise.resolve()];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, result.current.handleGenerate("prompt")];
                                    case 2:
                                        secondResult = _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(secondResult).toEqual({ accepted: false, optimisticOutputId: null });
                    (0, vitest_1.expect)(generateOutput).not.toHaveBeenCalled();
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                releasePreflight === null || releasePreflight === void 0 ? void 0 : releasePreflight();
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, firstSubmission];
                case 3:
                    _a.sent();
                    (0, vitest_1.expect)(firstResult).toEqual({ accepted: true, optimisticOutputId: null });
                    (0, vitest_1.expect)(generateOutput).toHaveBeenCalledTimes(1);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("blocks a fifth local generate before parent output state catches up", function () { return __awaiter(void 0, void 0, void 0, function () {
        var setUiNotice, generateOutput, params, result, results;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setUiNotice = vitest_1.vi.fn();
                    generateOutput = vitest_1.vi.fn();
                    params = createParams({
                        activeGenerationCount: 0,
                        generateOutput: generateOutput,
                        setUiNotice: asDispatch(setUiNotice),
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    results = [];
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                            return __generator(this, function (_l) {
                                switch (_l.label) {
                                    case 0:
                                        _b = (_a = results).push;
                                        return [4 /*yield*/, result.current.handleGenerate("prompt 1")];
                                    case 1:
                                        _b.apply(_a, [_l.sent()]);
                                        _d = (_c = results).push;
                                        return [4 /*yield*/, result.current.handleGenerate("prompt 2")];
                                    case 2:
                                        _d.apply(_c, [_l.sent()]);
                                        _f = (_e = results).push;
                                        return [4 /*yield*/, result.current.handleGenerate("prompt 3")];
                                    case 3:
                                        _f.apply(_e, [_l.sent()]);
                                        _h = (_g = results).push;
                                        return [4 /*yield*/, result.current.handleGenerate("prompt 4")];
                                    case 4:
                                        _h.apply(_g, [_l.sent()]);
                                        _k = (_j = results).push;
                                        return [4 /*yield*/, result.current.handleGenerate("prompt 5")];
                                    case 5:
                                        _k.apply(_j, [_l.sent()]);
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(results).toEqual([
                        { accepted: true, optimisticOutputId: null },
                        { accepted: true, optimisticOutputId: null },
                        { accepted: true, optimisticOutputId: null },
                        { accepted: true, optimisticOutputId: null },
                        { accepted: false, optimisticOutputId: null },
                    ]);
                    (0, vitest_1.expect)(generateOutput).toHaveBeenCalledTimes(4);
                    (0, vitest_1.expect)(setUiNotice).toHaveBeenCalledWith(concurrentGenerationCap_1.CONCURRENT_GENERATION_CAP_MESSAGE);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("blocks generate and shows the cap notice when four generations are already active", function () { return __awaiter(void 0, void 0, void 0, function () {
        var setUiNotice, generateOutput, params, result, generateResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setUiNotice = vitest_1.vi.fn();
                    generateOutput = vitest_1.vi.fn();
                    params = createParams({
                        activeGenerationCount: 4,
                        generateOutput: generateOutput,
                        setUiNotice: asDispatch(setUiNotice),
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    generateResult = null;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleGenerate("prompt")];
                                    case 1:
                                        generateResult = _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(generateResult).toEqual({ accepted: false, optimisticOutputId: null });
                    (0, vitest_1.expect)(generateOutput).not.toHaveBeenCalled();
                    (0, vitest_1.expect)(setUiNotice).toHaveBeenCalledWith(concurrentGenerationCap_1.CONCURRENT_GENERATION_CAP_MESSAGE);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("allows generate submissions while agent send is in flight", function () { return __awaiter(void 0, void 0, void 0, function () {
        var generateOutput, params, result, generateResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    generateOutput = vitest_1.vi.fn();
                    params = createParams({
                        agentBusy: true,
                        generateOutput: generateOutput,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    generateResult = null;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleGenerate("prompt")];
                                    case 1:
                                        generateResult = _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(generateOutput).toHaveBeenCalledTimes(1);
                    (0, vitest_1.expect)(generateResult).toEqual({ accepted: true, optimisticOutputId: null });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("inserts an optimistic placeholder before async submission prep and forwards its output id", function () { return __awaiter(void 0, void 0, void 0, function () {
        var callOrder, generateOutput, insertOptimisticGenerationPlaceholder, refreshCharacterModeInjectionBundleForSubmission, params, result, generateResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    callOrder = [];
                    generateOutput = vitest_1.vi.fn(function () {
                        callOrder.push("submit");
                    });
                    insertOptimisticGenerationPlaceholder = vitest_1.vi.fn(function () {
                        callOrder.push("placeholder");
                        return "out-optimistic";
                    });
                    refreshCharacterModeInjectionBundleForSubmission = vitest_1.vi.fn(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            callOrder.push("refresh");
                            return [2 /*return*/, null];
                        });
                    }); });
                    params = createParams({
                        generateOutput: generateOutput,
                        insertOptimisticGenerationPlaceholder: insertOptimisticGenerationPlaceholder,
                        refreshCharacterModeInjectionBundleForSubmission: refreshCharacterModeInjectionBundleForSubmission,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    generateResult = null;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleGenerate("prompt")];
                                    case 1:
                                        generateResult = _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(callOrder).toEqual(["placeholder", "refresh", "submit"]);
                    (0, vitest_1.expect)(insertOptimisticGenerationPlaceholder).toHaveBeenCalledWith({
                        prompt: "prompt",
                        modeOverride: "image",
                        selectedToolOverride: "create",
                    });
                    (0, vitest_1.expect)(generateOutput).toHaveBeenCalledWith("prompt", vitest_1.expect.objectContaining({ outputIdOverride: "out-optimistic" }));
                    (0, vitest_1.expect)(generateResult).toEqual({ accepted: true, optimisticOutputId: "out-optimistic" });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("cleans up optimistic placeholder when pre-submit character prep fails", function () { return __awaiter(void 0, void 0, void 0, function () {
        var setUiError, setOptimisticDebitEntries, generateOutput, insertOptimisticGenerationPlaceholder, removeOptimisticGenerationPlaceholder, refreshCharacterModeInjectionBundleForSubmission, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setUiError = vitest_1.vi.fn();
                    setOptimisticDebitEntries = vitest_1.vi.fn();
                    generateOutput = vitest_1.vi.fn();
                    insertOptimisticGenerationPlaceholder = vitest_1.vi.fn(function () { return "out-optimistic"; });
                    removeOptimisticGenerationPlaceholder = vitest_1.vi.fn();
                    refreshCharacterModeInjectionBundleForSubmission = vitest_1.vi.fn(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            throw new Error("Character context unavailable");
                        });
                    }); });
                    params = createParams({
                        setUiError: asDispatch(setUiError),
                        setOptimisticDebitEntries: asDispatch(setOptimisticDebitEntries),
                        generateOutput: generateOutput,
                        insertOptimisticGenerationPlaceholder: insertOptimisticGenerationPlaceholder,
                        removeOptimisticGenerationPlaceholder: removeOptimisticGenerationPlaceholder,
                        refreshCharacterModeInjectionBundleForSubmission: refreshCharacterModeInjectionBundleForSubmission,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleGenerate("prompt")];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(removeOptimisticGenerationPlaceholder).toHaveBeenCalledWith("out-optimistic");
                    (0, vitest_1.expect)(setUiError).toHaveBeenCalledWith("Character context unavailable");
                    (0, vitest_1.expect)(setOptimisticDebitEntries).not.toHaveBeenCalled();
                    (0, vitest_1.expect)(generateOutput).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("fails fast and removes optimistic placeholder when preflight times out", function () { return __awaiter(void 0, void 0, void 0, function () {
        var setUiError, generateOutput, insertOptimisticGenerationPlaceholder, removeOptimisticGenerationPlaceholder, trackCharacterModeEvent, refreshCharacterModeInjectionBundleForSubmission, params_1, result_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    vitest_1.vi.useFakeTimers();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, , 3, 4]);
                    setUiError = vitest_1.vi.fn();
                    generateOutput = vitest_1.vi.fn();
                    insertOptimisticGenerationPlaceholder = vitest_1.vi.fn(function () { return "out-optimistic"; });
                    removeOptimisticGenerationPlaceholder = vitest_1.vi.fn();
                    trackCharacterModeEvent = vitest_1.vi.fn();
                    refreshCharacterModeInjectionBundleForSubmission = vitest_1.vi.fn(function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, new Promise(function () {
                                        // intentionally unresolved to trigger timeout
                                    })];
                                case 1: return [2 /*return*/, _a.sent()];
                            }
                        });
                    }); });
                    params_1 = createParams({
                        setUiError: asDispatch(setUiError),
                        generateOutput: generateOutput,
                        insertOptimisticGenerationPlaceholder: insertOptimisticGenerationPlaceholder,
                        removeOptimisticGenerationPlaceholder: removeOptimisticGenerationPlaceholder,
                        trackCharacterModeEvent: trackCharacterModeEvent,
                        refreshCharacterModeInjectionBundleForSubmission: refreshCharacterModeInjectionBundleForSubmission,
                    });
                    result_1 = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params_1); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            var pending;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        pending = result_1.current.handleGenerate("prompt");
                                        return [4 /*yield*/, vitest_1.vi.advanceTimersByTimeAsync(10000)];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, pending];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 2:
                    _a.sent();
                    (0, vitest_1.expect)(removeOptimisticGenerationPlaceholder).toHaveBeenCalledWith("out-optimistic");
                    (0, vitest_1.expect)(setUiError).toHaveBeenCalledWith("Preparation timed out before generation started. Please retry.");
                    (0, vitest_1.expect)(generateOutput).not.toHaveBeenCalled();
                    (0, vitest_1.expect)(trackCharacterModeEvent).toHaveBeenCalledWith("generation_preflight_timeout", vitest_1.expect.objectContaining({ trigger: "generate", reason_code: "PREFLIGHT_TIMEOUT" }));
                    return [3 /*break*/, 4];
                case 3:
                    vitest_1.vi.useRealTimers();
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("fails generate when override cost cannot be covered after refresh", function () { return __awaiter(void 0, void 0, void 0, function () {
        var setUiError, refreshBalance, generateOutput, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setUiError = vitest_1.vi.fn();
                    refreshBalance = vitest_1.vi.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, 1];
                    }); }); });
                    generateOutput = vitest_1.vi.fn();
                    params = createParams({
                        effectiveBalanceCredits: 1,
                        balanceCredits: 1,
                        refreshBalance: refreshBalance,
                        setUiError: asDispatch(setUiError),
                        generateOutput: generateOutput,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleGenerate("prompt", { costOverrideCredits: 5 })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(refreshBalance).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ silent: true, beforeCommit: vitest_1.expect.any(Function) }));
                    (0, vitest_1.expect)(setUiError).toHaveBeenCalledWith("You do not have enough credits for this run.");
                    (0, vitest_1.expect)(generateOutput).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("accounts for uncovered optimistic debits after refresh", function () { return __awaiter(void 0, void 0, void 0, function () {
        var setUiError, refreshBalance, generateOutput, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setUiError = vitest_1.vi.fn();
                    refreshBalance = vitest_1.vi.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, 6];
                    }); }); });
                    generateOutput = vitest_1.vi.fn();
                    params = createParams({
                        effectiveBalanceCredits: 4,
                        balanceCredits: 6,
                        optimisticUncoveredDebitTotal: 2,
                        refreshBalance: refreshBalance,
                        setUiError: asDispatch(setUiError),
                        generateOutput: generateOutput,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleGenerate("prompt", { costOverrideCredits: 5 })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(refreshBalance).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ silent: true, beforeCommit: vitest_1.expect.any(Function) }));
                    (0, vitest_1.expect)(setUiError).toHaveBeenCalledWith("You do not have enough credits for this run.");
                    (0, vitest_1.expect)(generateOutput).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("uses authoritative snapshot refresh without re-subtracting optimistic holds", function () { return __awaiter(void 0, void 0, void 0, function () {
        var setUiError, generateOutput, refreshBalance, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setUiError = vitest_1.vi.fn();
                    generateOutput = vitest_1.vi.fn();
                    refreshBalance = vitest_1.vi.fn(function (options) { return __awaiter(void 0, void 0, void 0, function () {
                        var _a;
                        return __generator(this, function (_b) {
                            (_a = options === null || options === void 0 ? void 0 : options.beforeCommit) === null || _a === void 0 ? void 0 : _a.call(options, {
                                cents: 6,
                                updatedAt: "2026-02-15T21:00:00.000Z",
                                reservedCents: 2,
                                source: "snapshot",
                            });
                            return [2 /*return*/, 6];
                        });
                    }); });
                    params = createParams({
                        effectiveBalanceCredits: 4,
                        balanceCredits: 6,
                        optimisticUncoveredDebitTotal: 2,
                        refreshBalance: refreshBalance,
                        setUiError: asDispatch(setUiError),
                        generateOutput: generateOutput,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleGenerate("prompt", { costOverrideCredits: 5 })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(refreshBalance).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ silent: true, beforeCommit: vitest_1.expect.any(Function) }));
                    (0, vitest_1.expect)(setUiError).not.toHaveBeenCalledWith("You do not have enough credits for this run.");
                    (0, vitest_1.expect)(generateOutput).toHaveBeenCalledTimes(1);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("applies optimistic subtraction when refresh reports fallback source", function () { return __awaiter(void 0, void 0, void 0, function () {
        var setUiError, generateOutput, refreshBalance, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setUiError = vitest_1.vi.fn();
                    generateOutput = vitest_1.vi.fn();
                    refreshBalance = vitest_1.vi.fn(function (options) { return __awaiter(void 0, void 0, void 0, function () {
                        var _a;
                        return __generator(this, function (_b) {
                            (_a = options === null || options === void 0 ? void 0 : options.beforeCommit) === null || _a === void 0 ? void 0 : _a.call(options, {
                                cents: 6,
                                updatedAt: "2026-02-15T21:05:00.000Z",
                                reservedCents: null,
                                source: "fallback",
                            });
                            return [2 /*return*/, 6];
                        });
                    }); });
                    params = createParams({
                        effectiveBalanceCredits: 4,
                        balanceCredits: 6,
                        optimisticUncoveredDebitTotal: 2,
                        refreshBalance: refreshBalance,
                        setUiError: asDispatch(setUiError),
                        generateOutput: generateOutput,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleGenerate("prompt", { costOverrideCredits: 5 })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(refreshBalance).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ silent: true, beforeCommit: vitest_1.expect.any(Function) }));
                    (0, vitest_1.expect)(setUiError).toHaveBeenCalledWith("You do not have enough credits for this run.");
                    (0, vitest_1.expect)(generateOutput).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("regenerates with optimistic debit and submission overrides", function () { return __awaiter(void 0, void 0, void 0, function () {
        var setOptimisticDebitEntries, regenerateOutput, setUiNotice, resolveDefaultPromptForTool, refreshCharacterModeInjectionBundleForSubmission, resolveCharacterModeSubmissionOverrides, params, result, updater;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    setOptimisticDebitEntries = vitest_1.vi.fn();
                    regenerateOutput = vitest_1.vi.fn();
                    setUiNotice = vitest_1.vi.fn();
                    resolveDefaultPromptForTool = vitest_1.vi.fn(function () { return "default prompt"; });
                    refreshCharacterModeInjectionBundleForSubmission = vitest_1.vi.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, ({ bundle: true })];
                    }); }); });
                    resolveCharacterModeSubmissionOverrides = vitest_1.vi.fn(function () { return ({
                        submissionPromptOverride: "submission",
                        displayPromptOverride: "display",
                        referenceInputsOverride: ["https://example.com/ref.png"],
                        characterContextOverride: {
                            applied: true,
                            characterId: "char-1",
                            characterName: "A",
                            characterProfileImageUrl: null,
                        },
                        notice: "Character context applied",
                        fallbackCode: null,
                        characterReferenceCount: 1,
                        hasCharacterDescription: true,
                    }); });
                    params = createParams({
                        currentCostCredits: 7,
                        setOptimisticDebitEntries: asDispatch(setOptimisticDebitEntries),
                        regenerateOutput: regenerateOutput,
                        setUiNotice: asDispatch(setUiNotice),
                        resolveDefaultPromptForTool: resolveDefaultPromptForTool,
                        refreshCharacterModeInjectionBundleForSubmission: refreshCharacterModeInjectionBundleForSubmission,
                        resolveCharacterModeSubmissionOverrides: resolveCharacterModeSubmissionOverrides,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleRegenerateWithDebit()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _b.sent();
                    (0, vitest_1.expect)(resolveDefaultPromptForTool).toHaveBeenCalledWith("create");
                    (0, vitest_1.expect)(refreshCharacterModeInjectionBundleForSubmission).toHaveBeenCalledWith("create");
                    (0, vitest_1.expect)(regenerateOutput).toHaveBeenCalledWith({
                        modelIdOverride: "fal-ai/bytedance/seedream/v4.5/text-to-image",
                        submissionPromptOverride: "submission",
                        displayPromptOverride: "display",
                        referenceInputsOverride: ["https://example.com/ref.png"],
                        characterContextOverride: {
                            applied: true,
                            characterId: "char-1",
                            characterName: "A",
                            characterProfileImageUrl: null,
                        },
                    });
                    (0, vitest_1.expect)(setUiNotice).toHaveBeenCalledWith("Character context applied");
                    updater = (_a = setOptimisticDebitEntries.mock.calls[0]) === null || _a === void 0 ? void 0 : _a[0];
                    (0, vitest_1.expect)(typeof updater).toBe("function");
                    (0, vitest_1.expect)(updater === null || updater === void 0 ? void 0 : updater([])).toEqual([
                        vitest_1.expect.objectContaining({ credits: 7, outputId: null, createdAtMs: vitest_1.expect.any(Number) }),
                    ]);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("forwards explicit image regenerate reference overrides", function () { return __awaiter(void 0, void 0, void 0, function () {
        var regenerateOutput, resolveCharacterModeSubmissionOverrides, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    regenerateOutput = vitest_1.vi.fn();
                    resolveCharacterModeSubmissionOverrides = vitest_1.vi.fn(function () { return null; });
                    params = createParams({
                        selectedTool: "edit",
                        model: "fal-ai/bytedance/seedream/v5/lite/edit",
                        regenerateOutput: regenerateOutput,
                        resolveCharacterModeSubmissionOverrides: resolveCharacterModeSubmissionOverrides,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleImageRegenerateWithDebit({
                                            referenceInputsOverride: ["blob:flatten-primary", "https://example.com/extra.png"],
                                        })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(resolveCharacterModeSubmissionOverrides).toHaveBeenCalledWith("default prompt", "edit", null, ["blob:flatten-primary", "https://example.com/extra.png"]);
                    (0, vitest_1.expect)(regenerateOutput).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                        modelIdOverride: "fal-ai/bytedance/seedream/v5/lite/edit",
                        referenceInputsOverride: ["blob:flatten-primary", "https://example.com/extra.png"],
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("allows promptless regenerate when model override is Bria background remove", function () { return __awaiter(void 0, void 0, void 0, function () {
        var regenerateOutput, setUiError, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    regenerateOutput = vitest_1.vi.fn();
                    setUiError = vitest_1.vi.fn();
                    params = createParams({
                        selectedTool: "edit",
                        model: "fal-ai/bytedance/seedream/v5/lite/edit",
                        resolveDefaultPromptForTool: vitest_1.vi.fn(function () { return ""; }),
                        regenerateOutput: regenerateOutput,
                        setUiError: asDispatch(setUiError),
                        resolveCharacterModeSubmissionOverrides: vitest_1.vi.fn(function () { return null; }),
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleImageRegenerateWithDebit({
                                            referenceInputsOverride: ["blob:flatten-primary"],
                                            modelIdOverride: "fal-ai/bria/background/remove",
                                        })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(regenerateOutput).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                        modelIdOverride: "fal-ai/bria/background/remove",
                        referenceInputsOverride: ["blob:flatten-primary"],
                    }));
                    (0, vitest_1.expect)(setUiError).not.toHaveBeenCalledWith("Add a prompt to start a generation.");
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("forwards explicit regenerate display/submission prompt overrides", function () { return __awaiter(void 0, void 0, void 0, function () {
        var regenerateOutput, resolveCharacterModeSubmissionOverrides, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    regenerateOutput = vitest_1.vi.fn();
                    resolveCharacterModeSubmissionOverrides = vitest_1.vi.fn(function () { return null; });
                    params = createParams({
                        selectedTool: "edit",
                        model: "fal-ai/nano-banana-pro/edit",
                        resolveCharacterModeSubmissionOverrides: resolveCharacterModeSubmissionOverrides,
                        regenerateOutput: regenerateOutput,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleImageRegenerateWithDebit({
                                            displayPromptOverride: "raw @img1 prompt",
                                            submissionPromptOverride: "compiled Figure 2 prompt",
                                        })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(resolveCharacterModeSubmissionOverrides).toHaveBeenCalledWith("compiled Figure 2 prompt", "edit", null, ["https://example.com/reference.png"]);
                    (0, vitest_1.expect)(regenerateOutput).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                        displayPromptOverride: "raw @img1 prompt",
                        submissionPromptOverride: "compiled Figure 2 prompt",
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("prioritizes character-mode submission prompt override while preserving explicit display override", function () { return __awaiter(void 0, void 0, void 0, function () {
        var regenerateOutput, resolveCharacterModeSubmissionOverrides, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    regenerateOutput = vitest_1.vi.fn();
                    resolveCharacterModeSubmissionOverrides = vitest_1.vi.fn(function () { return ({
                        submissionPromptOverride: "character merged prompt",
                        displayPromptOverride: "character display prompt",
                        referenceInputsOverride: ["https://example.com/char-ref.png"],
                        notice: null,
                        fallbackCode: null,
                        characterReferenceCount: 1,
                        hasCharacterDescription: true,
                    }); });
                    params = createParams({
                        selectedTool: "edit",
                        model: "fal-ai/nano-banana-pro/edit",
                        isCharacterModeEnabled: true,
                        resolveCharacterModeSubmissionOverrides: resolveCharacterModeSubmissionOverrides,
                        regenerateOutput: regenerateOutput,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleImageRegenerateWithDebit({
                                            displayPromptOverride: "raw @img1 prompt",
                                            submissionPromptOverride: "compiled Figure 2 prompt",
                                        })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(regenerateOutput).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                        displayPromptOverride: "raw @img1 prompt",
                        submissionPromptOverride: "character merged prompt",
                        referenceInputsOverride: ["https://example.com/char-ref.png"],
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("uses regenerate cost override for credit guardrail checks and optimistic debit", function () { return __awaiter(void 0, void 0, void 0, function () {
        var regenerateOutput, setUiError, setOptimisticDebitEntries, params, result, updater;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    regenerateOutput = vitest_1.vi.fn();
                    setUiError = vitest_1.vi.fn();
                    setOptimisticDebitEntries = vitest_1.vi.fn();
                    params = createParams({
                        selectedTool: "edit",
                        model: "fal-ai/nano-banana-pro/edit",
                        currentCostCredits: 15,
                        effectiveBalanceCredits: 2,
                        balanceCredits: 2,
                        isGenerateDisabled: true,
                        isCreditGuardrail: true,
                        generationGuardrail: "You do not have enough credits for this run.",
                        refreshBalance: vitest_1.vi.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, 2];
                        }); }); }),
                        regenerateOutput: regenerateOutput,
                        resolveCharacterModeSubmissionOverrides: vitest_1.vi.fn(function () { return null; }),
                        setUiError: asDispatch(setUiError),
                        setOptimisticDebitEntries: asDispatch(setOptimisticDebitEntries),
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleImageRegenerateWithDebit({
                                            referenceInputsOverride: ["blob:flatten-primary"],
                                            modelIdOverride: "fal-ai/bria/background/remove",
                                            costOverrideCredits: 1,
                                        })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _b.sent();
                    (0, vitest_1.expect)(regenerateOutput).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                        modelIdOverride: "fal-ai/bria/background/remove",
                        referenceInputsOverride: ["blob:flatten-primary"],
                    }));
                    (0, vitest_1.expect)(setUiError).not.toHaveBeenCalled();
                    updater = (_a = setOptimisticDebitEntries.mock.calls[0]) === null || _a === void 0 ? void 0 : _a[0];
                    (0, vitest_1.expect)(typeof updater).toBe("function");
                    (0, vitest_1.expect)(updater === null || updater === void 0 ? void 0 : updater([])).toEqual([
                        vitest_1.expect.objectContaining({ credits: 1, outputId: null, createdAtMs: vitest_1.expect.any(Number) }),
                    ]);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("uses resolved model-override cost for inpaint regenerates when explicit cost override is absent", function () { return __awaiter(void 0, void 0, void 0, function () {
        var regenerateOutput, setUiError, setOptimisticDebitEntries, resolveCostCreditsForModel, params, result, updater;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    regenerateOutput = vitest_1.vi.fn();
                    setUiError = vitest_1.vi.fn();
                    setOptimisticDebitEntries = vitest_1.vi.fn();
                    resolveCostCreditsForModel = vitest_1.vi.fn(function (modelId) {
                        return modelId === inpaintSubmission_1.INPAINT_FLUX_FILL_MODEL_ID ? 5 : null;
                    });
                    params = createParams({
                        selectedTool: "edit",
                        model: "fal-ai/nano-banana-pro/edit",
                        currentCostCredits: 15,
                        effectiveBalanceCredits: 2,
                        balanceCredits: 2,
                        isGenerateDisabled: true,
                        isCreditGuardrail: true,
                        generationGuardrail: "You do not have enough credits for this run.",
                        refreshBalance: vitest_1.vi.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, 5];
                        }); }); }),
                        regenerateOutput: regenerateOutput,
                        resolveCharacterModeSubmissionOverrides: vitest_1.vi.fn(function () { return null; }),
                        resolveCostCreditsForModel: resolveCostCreditsForModel,
                        setUiError: asDispatch(setUiError),
                        setOptimisticDebitEntries: asDispatch(setOptimisticDebitEntries),
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleImageRegenerateWithDebit({
                                            modelIdOverride: inpaintSubmission_1.INPAINT_FLUX_FILL_MODEL_ID,
                                            inpaintOverride: {
                                                modelId: inpaintSubmission_1.INPAINT_FLUX_FILL_MODEL_ID,
                                                baseImageInput: "https://cdn.test/inpaint-base.png",
                                                maskInput: "https://cdn.test/inpaint-mask.png",
                                                outputFormat: "png",
                                            },
                                        })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _b.sent();
                    (0, vitest_1.expect)(resolveCostCreditsForModel).toHaveBeenCalledWith(inpaintSubmission_1.INPAINT_FLUX_FILL_MODEL_ID);
                    (0, vitest_1.expect)(regenerateOutput).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                        modelIdOverride: inpaintSubmission_1.INPAINT_FLUX_FILL_MODEL_ID,
                    }));
                    (0, vitest_1.expect)(setUiError).not.toHaveBeenCalled();
                    updater = (_a = setOptimisticDebitEntries.mock.calls[0]) === null || _a === void 0 ? void 0 : _a[0];
                    (0, vitest_1.expect)(typeof updater).toBe("function");
                    (0, vitest_1.expect)(updater === null || updater === void 0 ? void 0 : updater([])).toEqual([
                        vitest_1.expect.objectContaining({ credits: 5, outputId: null, createdAtMs: vitest_1.expect.any(Number) }),
                    ]);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("does not persist selected model when regenerate submit uses explicit modelIdOverride", function () { return __awaiter(void 0, void 0, void 0, function () {
        var regenerateOutput, setModel, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    regenerateOutput = vitest_1.vi.fn();
                    setModel = vitest_1.vi.fn();
                    params = createParams({
                        selectedTool: "edit",
                        model: "fal-ai/nano-banana-pro/edit",
                        setModel: setModel,
                        regenerateOutput: regenerateOutput,
                        resolveCharacterModeSubmissionOverrides: vitest_1.vi.fn(function () { return null; }),
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleImageRegenerateWithDebit({
                                            referenceInputsOverride: ["blob:flatten-primary"],
                                            modelIdOverride: "fal-ai/bria/background/remove",
                                            costOverrideCredits: 0,
                                        })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(setModel).not.toHaveBeenCalled();
                    (0, vitest_1.expect)(regenerateOutput).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                        modelIdOverride: "fal-ai/bria/background/remove",
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("does not persist selected model when regenerate submit uses inpaint model override", function () { return __awaiter(void 0, void 0, void 0, function () {
        var regenerateOutput, setModel, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    regenerateOutput = vitest_1.vi.fn();
                    setModel = vitest_1.vi.fn();
                    params = createParams({
                        selectedTool: "edit",
                        model: "fal-ai/nano-banana-pro/edit",
                        setModel: setModel,
                        regenerateOutput: regenerateOutput,
                        resolveCharacterModeSubmissionOverrides: vitest_1.vi.fn(function () { return null; }),
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleImageRegenerateWithDebit({
                                            inpaintOverride: {
                                                modelId: inpaintSubmission_1.INPAINT_FLUX_FILL_MODEL_ID,
                                                baseImageInput: "https://cdn.test/inpaint-base.png",
                                                maskInput: "https://cdn.test/inpaint-mask.png",
                                                outputFormat: "png",
                                            },
                                        })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(setModel).not.toHaveBeenCalled();
                    (0, vitest_1.expect)(regenerateOutput).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                        modelIdOverride: inpaintSubmission_1.INPAINT_FLUX_FILL_MODEL_ID,
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("allows regenerate submissions while agent send is in flight", function () { return __awaiter(void 0, void 0, void 0, function () {
        var regenerateOutput, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    regenerateOutput = vitest_1.vi.fn();
                    params = createParams({
                        agentBusy: true,
                        regenerateOutput: regenerateOutput,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleRegenerateWithDebit()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(regenerateOutput).toHaveBeenCalledTimes(1);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("blocks option-based generate when generation guardrails disable submissions", function () { return __awaiter(void 0, void 0, void 0, function () {
        var generateOutput, setUiError, setOptimisticDebitEntries, params, result, generateResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    generateOutput = vitest_1.vi.fn();
                    setUiError = vitest_1.vi.fn();
                    setOptimisticDebitEntries = vitest_1.vi.fn();
                    params = createParams({
                        isGenerateDisabled: true,
                        isCreditGuardrail: false,
                        generationGuardrail: "Guardrail blocked this run.",
                        generateOutput: generateOutput,
                        setUiError: asDispatch(setUiError),
                        setOptimisticDebitEntries: asDispatch(setOptimisticDebitEntries),
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    generateResult = null;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleGenerate("prompt override", {
                                            costOverrideCredits: 2,
                                        })];
                                    case 1:
                                        generateResult = _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(setUiError).toHaveBeenCalledWith("Guardrail blocked this run.");
                    (0, vitest_1.expect)(generateOutput).not.toHaveBeenCalled();
                    (0, vitest_1.expect)(setOptimisticDebitEntries).not.toHaveBeenCalled();
                    (0, vitest_1.expect)(generateResult).toEqual({ accepted: false, optimisticOutputId: null });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("surfaces explicit error and does not submit when create/text tool remains in text mode", function () { return __awaiter(void 0, void 0, void 0, function () {
        var generateOutput, setOptimisticDebitEntries, setUiError, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    generateOutput = vitest_1.vi.fn();
                    setOptimisticDebitEntries = vitest_1.vi.fn();
                    setUiError = vitest_1.vi.fn();
                    params = createParams({
                        mode: "text",
                        selectedTool: "create",
                        generateOutput: generateOutput,
                        setUiError: asDispatch(setUiError),
                        setOptimisticDebitEntries: asDispatch(setOptimisticDebitEntries),
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleGenerate("prompt override", { costOverrideCredits: 2 })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(generateOutput).not.toHaveBeenCalled();
                    (0, vitest_1.expect)(setOptimisticDebitEntries).not.toHaveBeenCalled();
                    (0, vitest_1.expect)(setUiError).toHaveBeenCalledWith("Switch to image generation before running this action.");
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("blocks create character-mode generate when no character references are available", function () { return __awaiter(void 0, void 0, void 0, function () {
        var setUiError, generateOutput, trackCharacterModeEvent, resolveCharacterModeSubmissionOverrides, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setUiError = vitest_1.vi.fn();
                    generateOutput = vitest_1.vi.fn();
                    trackCharacterModeEvent = vitest_1.vi.fn();
                    resolveCharacterModeSubmissionOverrides = vitest_1.vi.fn(function () { return ({
                        submissionPromptOverride: "character + prompt",
                        displayPromptOverride: "user prompt",
                        referenceInputsOverride: [],
                        notice: null,
                        fallbackCode: "no_references",
                        characterReferenceCount: 0,
                        hasCharacterDescription: true,
                    }); });
                    params = createParams({
                        setUiError: asDispatch(setUiError),
                        generateOutput: generateOutput,
                        trackCharacterModeEvent: trackCharacterModeEvent,
                        resolveCharacterModeSubmissionOverrides: resolveCharacterModeSubmissionOverrides,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleGenerate("user prompt")];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(generateOutput).not.toHaveBeenCalled();
                    (0, vitest_1.expect)(setUiError).toHaveBeenCalledWith("Character Mode requires at least one character image before generating.");
                    (0, vitest_1.expect)(trackCharacterModeEvent).toHaveBeenCalledWith("character_mode_submit_blocked_no_references", vitest_1.expect.objectContaining({ fallback_code: "no_references", tool: "create" }));
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("blocks character-mode regenerate when no character references are available", function () { return __awaiter(void 0, void 0, void 0, function () {
        var setUiError, regenerateOutput, trackCharacterModeEvent, resolveCharacterModeSubmissionOverrides, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setUiError = vitest_1.vi.fn();
                    regenerateOutput = vitest_1.vi.fn();
                    trackCharacterModeEvent = vitest_1.vi.fn();
                    resolveCharacterModeSubmissionOverrides = vitest_1.vi.fn(function () { return ({
                        submissionPromptOverride: "character + prompt",
                        displayPromptOverride: "user prompt",
                        referenceInputsOverride: [],
                        notice: null,
                        fallbackCode: "no_references",
                        characterReferenceCount: 0,
                        hasCharacterDescription: true,
                    }); });
                    params = createParams({
                        setUiError: asDispatch(setUiError),
                        regenerateOutput: regenerateOutput,
                        trackCharacterModeEvent: trackCharacterModeEvent,
                        resolveCharacterModeSubmissionOverrides: resolveCharacterModeSubmissionOverrides,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleRegenerateWithDebit()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(regenerateOutput).not.toHaveBeenCalled();
                    (0, vitest_1.expect)(setUiError).toHaveBeenCalledWith("Character Mode requires at least one character image before generating.");
                    (0, vitest_1.expect)(trackCharacterModeEvent).toHaveBeenCalledWith("character_mode_submit_blocked_no_references", vitest_1.expect.objectContaining({ fallback_code: "no_references", tool: "create" }));
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("blocks create character-mode generate when no character is selected", function () { return __awaiter(void 0, void 0, void 0, function () {
        var setUiError, generateOutput, trackCharacterModeEvent, resolveCharacterModeSubmissionOverrides, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setUiError = vitest_1.vi.fn();
                    generateOutput = vitest_1.vi.fn();
                    trackCharacterModeEvent = vitest_1.vi.fn();
                    resolveCharacterModeSubmissionOverrides = vitest_1.vi.fn(function () { return ({
                        submissionPromptOverride: "character + prompt",
                        displayPromptOverride: "user prompt",
                        referenceInputsOverride: [],
                        notice: null,
                        fallbackCode: "no_character_selected",
                        characterReferenceCount: 0,
                        hasCharacterDescription: false,
                    }); });
                    params = createParams({
                        setUiError: asDispatch(setUiError),
                        generateOutput: generateOutput,
                        trackCharacterModeEvent: trackCharacterModeEvent,
                        resolveCharacterModeSubmissionOverrides: resolveCharacterModeSubmissionOverrides,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleGenerate("user prompt")];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(generateOutput).not.toHaveBeenCalled();
                    (0, vitest_1.expect)(setUiError).toHaveBeenCalledWith("Character Mode requires at least one character image before generating.");
                    (0, vitest_1.expect)(trackCharacterModeEvent).toHaveBeenCalledWith("character_mode_submit_blocked_no_references", vitest_1.expect.objectContaining({ fallback_code: "no_character_selected", tool: "create" }));
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("coerces create character-mode submissions to paired edit model at submit-time", function () { return __awaiter(void 0, void 0, void 0, function () {
        var setModel, generateOutput, trackCharacterModeEvent, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setModel = vitest_1.vi.fn();
                    generateOutput = vitest_1.vi.fn();
                    trackCharacterModeEvent = vitest_1.vi.fn();
                    params = createParams({
                        model: "fal-ai/nano-banana-pro",
                        setModel: setModel,
                        isCharacterModeEnabled: true,
                        generateOutput: generateOutput,
                        trackCharacterModeEvent: trackCharacterModeEvent,
                        resolveCharacterModeSubmissionOverrides: vitest_1.vi.fn(function () { return ({
                            submissionPromptOverride: "character + prompt",
                            displayPromptOverride: "user prompt",
                            referenceInputsOverride: ["https://example.com/char-ref.png"],
                            notice: null,
                            fallbackCode: null,
                            characterReferenceCount: 1,
                            hasCharacterDescription: true,
                        }); }),
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleGenerate("user prompt")];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(setModel).toHaveBeenCalledWith("fal-ai/nano-banana-pro/edit");
                    (0, vitest_1.expect)(trackCharacterModeEvent).toHaveBeenCalledWith("character_mode_submit_invariant_coerced", vitest_1.expect.objectContaining({
                        trigger: "generate",
                        from_model_id: "fal-ai/nano-banana-pro",
                        to_model_id: "fal-ai/nano-banana-pro/edit",
                    }));
                    (0, vitest_1.expect)(generateOutput).toHaveBeenCalledWith("user prompt", vitest_1.expect.objectContaining({ modelIdOverride: "fal-ai/nano-banana-pro/edit" }));
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)("passes user-selected edit references into character mode override resolution", function () { return __awaiter(void 0, void 0, void 0, function () {
        var resolveCharacterModeSubmissionOverrides, resolveReferenceInputsForTool, params, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    resolveCharacterModeSubmissionOverrides = vitest_1.vi.fn(function () { return null; });
                    resolveReferenceInputsForTool = vitest_1.vi.fn(function () { return ({
                        referenceImageUrl: "https://example.com/primary.png",
                        extraImageUrls: [
                            "https://example.com/extra-1.png",
                            "https://example.com/extra-2.png",
                            null,
                        ],
                    }); });
                    params = createParams({
                        mode: "image",
                        selectedTool: "edit",
                        model: "fal-ai/nano-banana/edit",
                        isCharacterModeEnabled: true,
                        resolveCharacterModeSubmissionOverrides: resolveCharacterModeSubmissionOverrides,
                        resolveReferenceInputsForTool: resolveReferenceInputsForTool,
                    });
                    result = (0, react_1.renderHook)(function () { return (0, useAiStudioGenerationController_1.useAiStudioGenerationController)(params); }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, result.current.handleGenerate("user prompt")];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(resolveCharacterModeSubmissionOverrides).toHaveBeenCalledWith("user prompt", "edit", null, [
                        "https://example.com/primary.png",
                        "https://example.com/extra-1.png",
                        "https://example.com/extra-2.png",
                    ]);
                    return [2 /*return*/];
            }
        });
    }); });
});
