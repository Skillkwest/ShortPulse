"use strict";
/**
 * Shared prompt text sanitization utilities for agent runtime and client logic.
 * Kept outside AI Studio feature modules so agent code does not depend on studio internals.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeGenerationPromptText = exports.removeAspectRatioLanguage = exports.normalizePromptText = void 0;
var stripAspectRatioPhrases = function (value) {
    var ratioToken = "\\d{1,2}\\s*:\\s*\\d{1,2}";
    var ratioPatterns = [
        new RegExp("\\b(?:in|at|with|for)\\s+(?:an?\\s+)?(?:vertical|portrait|horizontal|landscape|square)\\s+".concat(ratioToken, "\\s+(?:frame|composition|ratio)\\b"), "gi"),
        new RegExp("\\b(?:vertical|portrait|horizontal|landscape|square)\\s+".concat(ratioToken, "\\b"), "gi"),
        new RegExp("\\b(?:aspect\\s*ratio|ratio)\\s*(?:(?:of|is|:)\\s*)?".concat(ratioToken, "\\b"), "gi"),
        new RegExp("\\b".concat(ratioToken, "\\s*(?:aspect\\s*ratio|ratio|frame|composition)\\b"), "gi"),
        /\baspect\s*ratio\b/gi,
        new RegExp("\\b".concat(ratioToken, "\\b"), "gi"),
    ];
    var next = value;
    ratioPatterns.forEach(function (pattern) {
        next = next.replace(pattern, " ");
    });
    return next
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/([,.;:!?]){2,}/g, "$1")
        .replace(/\s{2,}/g, " ")
        .trim();
};
var clean = function (value) {
    if (typeof value !== "string")
        return null;
    var trimmed = stripAspectRatioPhrases(value).trim();
    return trimmed.length ? trimmed : null;
};
var META_PREFIX_PATTERN = /^\s*(?:summary|change summary|changes made|what changed|edit summary)\s*:/i;
var META_SENTENCE_PATTERNS = [
    /\b(?:the|this)\s+prompt\b/i,
    /\b(?:the|this)\s+version\b/i,
    /\bprompt\s+now\s+includes\b/i,
    /\bnow\s+includes\b/i,
    /\btransformed\s+the\s+prompt\b/i,
    /\bupdated\s+the\s+prompt\b/i,
    /\b(?:has|have)\s+been\s+described\s+in\s+detail\b/i,
    /\bchanges?\s+(?:made|applied)\b/i,
];
var stripMetaPromptLanguage = function (value) {
    var normalized = value.replace(/\r\n/g, "\n");
    var paragraphs = normalized.split(/\n{2,}/);
    var cleanedParagraphs = paragraphs
        .map(function (paragraph) { return paragraph.trim(); })
        .filter(Boolean)
        .map(function (paragraph) {
        if (META_PREFIX_PATTERN.test(paragraph))
            return "";
        var sentences = paragraph.split(/(?<=[.!?])\s+/);
        var kept = sentences
            .map(function (sentence) { return sentence.trim(); })
            .filter(Boolean)
            .filter(function (sentence) {
            return !META_PREFIX_PATTERN.test(sentence) &&
                !META_SENTENCE_PATTERNS.some(function (pattern) { return pattern.test(sentence); });
        });
        return kept.join(" ").trim();
    })
        .filter(Boolean);
    return cleanedParagraphs.join("\n\n").trim();
};
/**
 * Normalizes prompt text and returns null for blank or invalid values.
 */
var normalizePromptText = function (value) {
    return (0, exports.sanitizeGenerationPromptText)(value);
};
exports.normalizePromptText = normalizePromptText;
/**
 * Removes aspect-ratio language (e.g. 9:16, 16:9) from prompt text.
 */
var removeAspectRatioLanguage = function (value) {
    return clean(value);
};
exports.removeAspectRatioLanguage = removeAspectRatioLanguage;
/**
 * Removes metadata-like recap tails from model-generated prompts.
 */
var sanitizeGenerationPromptText = function (value) {
    var cleaned = clean(value);
    if (!cleaned)
        return null;
    var withoutMeta = stripMetaPromptLanguage(cleaned);
    return withoutMeta.length ? withoutMeta : null;
};
exports.sanitizeGenerationPromptText = sanitizeGenerationPromptText;
