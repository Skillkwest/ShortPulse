"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCanvasWorkflow = exports.isCharacterWorkflow = exports.isVideoWorkflow = exports.isEditWorkflow = exports.isCreateWorkflow = exports.normalizeToolId = exports.resolveWorkflowId = void 0;
/**
 * Returns a canonical workflow identity for a selected tool id.
 */
var resolveWorkflowId = function (tool) {
    switch (tool) {
        case "create":
        case "text":
            return "create";
        case "edit":
        case "image":
            return "edit";
        case "video":
        case "kling":
            return "video";
        case "character":
            return "character";
        case "canvas":
            return "canvas";
        default:
            return "none";
    }
};
exports.resolveWorkflowId = resolveWorkflowId;
/**
 * Normalizes a tool id to its canonical primary id while keeping null stable.
 */
var normalizeToolId = function (tool) {
    switch ((0, exports.resolveWorkflowId)(tool)) {
        case "create":
            return "create";
        case "edit":
            return "edit";
        case "video":
            return "video";
        case "character":
            return "character";
        case "canvas":
            return "canvas";
        default:
            return null;
    }
};
exports.normalizeToolId = normalizeToolId;
/**
 * Returns true when the workflow is the canonical Create workflow.
 */
var isCreateWorkflow = function (tool) {
    return (0, exports.resolveWorkflowId)(tool) === "create";
};
exports.isCreateWorkflow = isCreateWorkflow;
/**
 * Returns true when the workflow is the canonical Edit workflow.
 */
var isEditWorkflow = function (tool) {
    return (0, exports.resolveWorkflowId)(tool) === "edit";
};
exports.isEditWorkflow = isEditWorkflow;
/**
 * Returns true when the workflow is the canonical Video workflow.
 */
var isVideoWorkflow = function (tool) {
    return (0, exports.resolveWorkflowId)(tool) === "video";
};
exports.isVideoWorkflow = isVideoWorkflow;
/**
 * Returns true when the workflow is the canonical Character workflow.
 */
var isCharacterWorkflow = function (tool) {
    return (0, exports.resolveWorkflowId)(tool) === "character";
};
exports.isCharacterWorkflow = isCharacterWorkflow;
/**
 * Returns true when the workflow is the canonical Canvas workflow.
 */
var isCanvasWorkflow = function (tool) {
    return (0, exports.resolveWorkflowId)(tool) === "canvas";
};
exports.isCanvasWorkflow = isCanvasWorkflow;
