"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAgentOutputGenerateRequest = exports.resolveChatOffCreatePrompt = void 0;
var agentPromptOwnership_1 = require("./agentPromptOwnership");
var isAgentOutputPromptSource = function (value) {
    return value === "history" || value === "staged";
};
/**
 * Resolves the prompt used for chat-off create submits.
 */
var resolveChatOffCreatePrompt = function (_a) {
    var agentInput = _a.agentInput, sharedPrompt = _a.sharedPrompt, allowSharedPromptFallback = _a.allowSharedPromptFallback;
    var trimmedAgentInput = agentInput.trim();
    if (trimmedAgentInput)
        return trimmedAgentInput;
    if (!allowSharedPromptFallback)
        return null;
    var trimmedSharedPrompt = sharedPrompt.trim();
    return trimmedSharedPrompt || null;
};
exports.resolveChatOffCreatePrompt = resolveChatOffCreatePrompt;
/**
 * Normalizes incoming generate requests from agent-output surfaces.
 */
var normalizeAgentOutputGenerateRequest = function (input) {
    if (typeof input === "string") {
        var legacyPrompt = (0, agentPromptOwnership_1.normalizePromptText)(input);
        if (!legacyPrompt)
            return null;
        return {
            messageId: "legacy-agent-output",
            prompt: legacyPrompt,
            source: "history",
        };
    }
    if (!input || typeof input !== "object")
        return null;
    var normalizedPrompt = (0, agentPromptOwnership_1.normalizePromptText)(input.prompt);
    var messageId = typeof input.messageId === "string" ? input.messageId.trim() : "";
    if (!normalizedPrompt || !messageId)
        return null;
    return {
        messageId: messageId,
        prompt: normalizedPrompt,
        source: isAgentOutputPromptSource(input.source) ? input.source : "history",
    };
};
exports.normalizeAgentOutputGenerateRequest = normalizeAgentOutputGenerateRequest;
