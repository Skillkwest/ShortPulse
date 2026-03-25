"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.countInFlightGenerations = exports.isOutputGenerationInFlight = exports.isConcurrentGenerationCapMessage = exports.CONCURRENT_GENERATION_CAP_MESSAGE = exports.MAX_CONCURRENT_GENERATIONS = void 0;
exports.MAX_CONCURRENT_GENERATIONS = 4;
exports.CONCURRENT_GENERATION_CAP_MESSAGE = "4 max concurrent generations. Wait for one to finish before starting another.";
var isConcurrentGenerationCapMessage = function (value) {
    return value === exports.CONCURRENT_GENERATION_CAP_MESSAGE;
};
exports.isConcurrentGenerationCapMessage = isConcurrentGenerationCapMessage;
var isOutputGenerationInFlight = function (output) {
    return output.taskState === "pending" || output.taskState === "running";
};
exports.isOutputGenerationInFlight = isOutputGenerationInFlight;
var countInFlightGenerations = function (outputs) {
    var seenIds = new Set();
    var count = 0;
    outputs.forEach(function (output) {
        if (seenIds.has(output.id))
            return;
        seenIds.add(output.id);
        if ((0, exports.isOutputGenerationInFlight)(output)) {
            count += 1;
        }
    });
    return count;
};
exports.countInFlightGenerations = countInFlightGenerations;
