"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEffectiveEditSubmitModelId = exports.resolveEditSubmitIntentFromRailSelection = exports.resolveEditSubmitIntentFromInpaintSelection = exports.DEFAULT_EDIT_SUBMIT_INTENT = void 0;
/**
 * Edit submit-intent helpers.
 * Keeps expert-edit inpaint intent mapping centralized for orchestration and pricing coherence.
 */
var inpaintSubmission_1 = require("./inpaintSubmission");
var workflowIdentity_1 = require("./workflowIdentity");
exports.DEFAULT_EDIT_SUBMIT_INTENT = "standard";
/**
 * Maps inpaint rail selection to submit intent used by orchestration.
 */
var resolveEditSubmitIntentFromInpaintSelection = function (isInpaintSelected) { return (isInpaintSelected ? "inpaint" : "standard"); };
exports.resolveEditSubmitIntentFromInpaintSelection = resolveEditSubmitIntentFromInpaintSelection;
/**
 * Maps rail-tool selection to submit intent used by orchestration.
 */
var resolveEditSubmitIntentFromRailSelection = function (_a) {
    var isInpaintSelected = _a.isInpaintSelected, isMarkupSelected = _a.isMarkupSelected;
    if (isInpaintSelected)
        return "inpaint";
    if (isMarkupSelected)
        return "markup";
    return "standard";
};
exports.resolveEditSubmitIntentFromRailSelection = resolveEditSubmitIntentFromRailSelection;
/**
 * Resolves the effective model id used for edit-workflow cost/guardrail calculations.
 */
var resolveEffectiveEditSubmitModelId = function (_a) {
    var selectedTool = _a.selectedTool, selectedModelId = _a.selectedModelId, editSubmitIntent = _a.editSubmitIntent;
    if ((0, workflowIdentity_1.isEditWorkflow)(selectedTool) && editSubmitIntent === "inpaint") {
        return inpaintSubmission_1.INPAINT_FLUX_FILL_MODEL_ID;
    }
    if ((0, workflowIdentity_1.isEditWorkflow)(selectedTool) && editSubmitIntent === "markup" && (0, inpaintSubmission_1.isMarkupModelLockEnabled)()) {
        return inpaintSubmission_1.MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID;
    }
    return selectedModelId;
};
exports.resolveEffectiveEditSubmitModelId = resolveEffectiveEditSubmitModelId;
