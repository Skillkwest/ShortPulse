"use strict";
/**
 * Async deadline utility for pre-submit generation phases.
 * Prevents indefinite UI spinners when prerequisite work stalls.
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.withAbortableDeadline = exports.withDeadline = exports.DeadlineExceededError = void 0;
var DeadlineExceededError = /** @class */ (function (_super) {
    __extends(DeadlineExceededError, _super);
    function DeadlineExceededError(message, timeoutMs) {
        var _this = _super.call(this, message) || this;
        _this.name = "DeadlineExceededError";
        _this.timeoutMs = timeoutMs;
        _this.code = "DEADLINE_EXCEEDED";
        return _this;
    }
    return DeadlineExceededError;
}(Error));
exports.DeadlineExceededError = DeadlineExceededError;
/**
 * Runs async work with a deadline and rejects with `DeadlineExceededError` on timeout.
 */
var withDeadline = function (_a) {
    var timeoutMs = _a.timeoutMs, timeoutMessage = _a.timeoutMessage, run = _a.run;
    return __awaiter(void 0, void 0, void 0, function () {
        var timeoutHandle, timeoutPromise;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    timeoutHandle = null;
                    timeoutPromise = new Promise(function (_resolve, reject) {
                        timeoutHandle = globalThis.setTimeout(function () {
                            reject(new DeadlineExceededError(timeoutMessage, timeoutMs));
                        }, timeoutMs);
                    });
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, , 3, 4]);
                    return [4 /*yield*/, Promise.race([run(), timeoutPromise])];
                case 2: return [2 /*return*/, _b.sent()];
                case 3:
                    if (timeoutHandle) {
                        globalThis.clearTimeout(timeoutHandle);
                    }
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    });
};
exports.withDeadline = withDeadline;
/**
 * Runs async work with a deadline and a timeout-linked abort signal.
 * If the deadline expires, callers receive `DeadlineExceededError` and in-flight work is aborted.
 */
var withAbortableDeadline = function (_a) {
    var timeoutMs = _a.timeoutMs, timeoutMessage = _a.timeoutMessage, run = _a.run;
    return __awaiter(void 0, void 0, void 0, function () {
        var timeoutController, timeoutHandle, timeoutPromise;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    timeoutController = new AbortController();
                    timeoutHandle = null;
                    timeoutPromise = new Promise(function (_resolve, reject) {
                        timeoutHandle = globalThis.setTimeout(function () {
                            timeoutController.abort();
                            reject(new DeadlineExceededError(timeoutMessage, timeoutMs));
                        }, timeoutMs);
                    });
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, , 3, 4]);
                    return [4 /*yield*/, Promise.race([run(timeoutController.signal), timeoutPromise])];
                case 2: return [2 /*return*/, _b.sent()];
                case 3:
                    if (timeoutHandle) {
                        globalThis.clearTimeout(timeoutHandle);
                    }
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    });
};
exports.withAbortableDeadline = withAbortableDeadline;
