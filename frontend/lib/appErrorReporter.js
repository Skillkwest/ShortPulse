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
exports.installGlobalAppErrorHandlers = exports.reportAppError = void 0;
/**
 * Browser-side reporter for actionable application failures.
 * Sends structured events to `/api/log/client-error` for admin triage.
 */
var supabaseClient_1 = require("./supabaseClient");
var clientBreadcrumbs_1 = require("./clientBreadcrumbs");
var MAX_MESSAGE_LENGTH = 600;
var listenersInstalled = false;
var normalizeText = function (value, maxLength) {
    if (maxLength === void 0) { maxLength = MAX_MESSAGE_LENGTH; }
    if (typeof value !== "string")
        return null;
    var trimmed = value.trim();
    if (!trimmed.length)
        return null;
    return trimmed.slice(0, maxLength);
};
var currentRoute = function () {
    if (typeof window === "undefined")
        return null;
    return "".concat(window.location.pathname).concat(window.location.search).slice(0, 300);
};
var resolveMessageAndStack = function (error) {
    var _a, _b, _c;
    if (error instanceof Error) {
        return {
            message: (_a = normalizeText(error.message)) !== null && _a !== void 0 ? _a : "Unknown runtime error",
            stack: normalizeText(error.stack, 6000),
        };
    }
    if (typeof error === "string") {
        return { message: (_b = normalizeText(error)) !== null && _b !== void 0 ? _b : "Unknown runtime error", stack: null };
    }
    if (error && typeof error === "object") {
        var maybeMessage = normalizeText(error.message);
        return {
            message: (_c = maybeMessage !== null && maybeMessage !== void 0 ? maybeMessage : normalizeText(String(error))) !== null && _c !== void 0 ? _c : "Unknown runtime error",
            stack: null,
        };
    }
    return { message: "Unknown runtime error", stack: null };
};
var readAccessToken = function () { return __awaiter(void 0, void 0, void 0, function () {
    var supabase, _a, data, error, _b;
    var _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _e.trys.push([0, 2, , 3]);
                supabase = (0, supabaseClient_1.ensureSupabaseClient)();
                return [4 /*yield*/, supabase.auth.getSession()];
            case 1:
                _a = _e.sent(), data = _a.data, error = _a.error;
                if (error)
                    return [2 /*return*/, null];
                return [2 /*return*/, (_d = (_c = data.session) === null || _c === void 0 ? void 0 : _c.access_token) !== null && _d !== void 0 ? _d : null];
            case 2:
                _b = _e.sent();
                return [2 /*return*/, null];
            case 3: return [2 /*return*/];
        }
    });
}); };
var endpointPath = function (endpoint) {
    var normalized = normalizeText(endpoint, 400);
    if (!normalized)
        return null;
    if (normalized.startsWith("/"))
        return normalized;
    try {
        var base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
        var parsed = new URL(normalized, base);
        return "".concat(parsed.pathname).concat(parsed.search).slice(0, 400);
    }
    catch (_a) {
        return normalized;
    }
};
var isFastRefreshNoise = function (event) {
    var _a, _b, _c, _d;
    // Only suppress in development. In production, we want to see everything.
    if (process.env.NODE_ENV !== "development")
        return false;
    var message = ((_a = normalizeText(event.message)) !== null && _a !== void 0 ? _a : "").toLowerCase();
    var stack = ((_c = normalizeText((_b = event.stack) !== null && _b !== void 0 ? _b : "", 8000)) !== null && _c !== void 0 ? _c : "").toLowerCase();
    var metaFilename = normalizeText((_d = event.metadata) === null || _d === void 0 ? void 0 : _d.filename, 400);
    var haystack = "".concat(message, "\n").concat(stack);
    // Next/React Fast Refresh commonly surfaces hook-state invariants during HMR.
    var hasReactRefreshFrames = haystack.includes("react-refresh") ||
        haystack.includes("performreactrefresh") ||
        haystack.includes("schedulerefresh") ||
        haystack.includes("@next/react-refresh-utils") ||
        haystack.includes("_next/static/chunks/webpack") ||
        haystack.includes("webpack-internal:///./node_modules/next/dist/compiled/react-refresh");
    if (!hasReactRefreshFrames)
        return false;
    // Narrow further to the common dev-only hook queue invariant we saw in incidents.
    var looksLikeHookQueueInvariant = message.includes("should have a queue") || stack.includes("should have a queue");
    if (looksLikeHookQueueInvariant)
        return true;
    // If we have react-refresh frames and the error originates from the refresh runtime file,
    // treat it as non-actionable dev noise.
    if (typeof metaFilename === "string" && /react-refresh|webpack|hot-update/i.test(metaFilename)) {
        return true;
    }
    return false;
};
var shouldSkip = function (event) {
    var _a, _b;
    var scope = (_a = event.scope) !== null && _a !== void 0 ? _a : "app";
    if (isFastRefreshNoise(event))
        return true;
    var message = (_b = normalizeText(event.message)) !== null && _b !== void 0 ? _b : "Unknown runtime error";
    var endpoint = endpointPath(event.endpoint);
    if (endpoint === null || endpoint === void 0 ? void 0 : endpoint.includes("/api/log/client-error"))
        return true;
    if (typeof event.statusCode === "number" && Number.isFinite(event.statusCode)) {
        var statusCode = event.statusCode;
        if (scope === "app" && statusCode < 400) {
            return true;
        }
        if (scope === "generation" && statusCode < 400) {
            return true;
        }
    }
    if (scope === "app" &&
        event.source === "client.api_network" &&
        /aborterror|aborted/i.test(message)) {
        return true;
    }
    return false;
};
var resolveClientReleaseMetadata = function () {
    var _a, _b, _c, _d;
    return ({
        client_release: (_b = (_a = normalizeText(process.env.NEXT_PUBLIC_SHORTPULSE_RELEASE, 120)) !== null && _a !== void 0 ? _a : normalizeText(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA, 120)) !== null && _b !== void 0 ? _b : null,
        client_environment: (_d = (_c = normalizeText(process.env.NEXT_PUBLIC_VERCEL_ENV, 80)) !== null && _c !== void 0 ? _c : normalizeText(process.env.NODE_ENV, 80)) !== null && _d !== void 0 ? _d : null,
    });
};
var resolveClientRuntimeMetadata = function () {
    if (typeof window === "undefined") {
        return {
            build_id: null,
            session_id: null,
            is_secure_context: null,
            visibility_state: null,
        };
    }
    var nextData = window.__NEXT_DATA__;
    var buildId = normalizeText(nextData === null || nextData === void 0 ? void 0 : nextData.buildId, 120);
    var sessionId = null;
    try {
        var stored = window.sessionStorage.getItem("sp_session_id");
        if (stored) {
            sessionId = stored;
        }
        else if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            sessionId = crypto.randomUUID();
            window.sessionStorage.setItem("sp_session_id", sessionId);
        }
        else {
            sessionId = "sp_".concat(Date.now(), "_").concat(Math.random().toString(36).slice(2, 10));
            window.sessionStorage.setItem("sp_session_id", sessionId);
        }
    }
    catch (_a) {
        sessionId = null;
    }
    return {
        build_id: buildId,
        session_id: sessionId,
        is_secure_context: typeof window.isSecureContext === "boolean" ? window.isSecureContext : null,
        visibility_state: typeof document !== "undefined" ? normalizeText(document.visibilityState, 40) : null,
    };
};
var reportToApi = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var token, endpoint;
    var _a, _b, _c, _d, _e, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0: return [4 /*yield*/, readAccessToken()];
            case 1:
                token = _h.sent();
                if (!token)
                    return [2 /*return*/];
                endpoint = "/api/log/client-error";
                return [4 /*yield*/, fetch(endpoint, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: "Bearer ".concat(token),
                        },
                        body: JSON.stringify({
                            source: event.source,
                            scope: (_a = event.scope) !== null && _a !== void 0 ? _a : "app",
                            severity: (_b = event.severity) !== null && _b !== void 0 ? _b : "medium",
                            message: (_c = normalizeText(event.message)) !== null && _c !== void 0 ? _c : "Unknown runtime error",
                            stack: normalizeText((_d = event.stack) !== null && _d !== void 0 ? _d : "", 6000),
                            route: (_e = normalizeText(event.route)) !== null && _e !== void 0 ? _e : currentRoute(),
                            endpoint: endpointPath(event.endpoint),
                            requestId: normalizeText(event.requestId, 120),
                            statusCode: typeof event.statusCode === "number" ? Math.trunc(event.statusCode) : null,
                            metadata: __assign(__assign(__assign(__assign({}, resolveClientReleaseMetadata()), resolveClientRuntimeMetadata()), { breadcrumbs: (0, clientBreadcrumbs_1.getBreadcrumbsSnapshot)() }), ((_f = event.metadata) !== null && _f !== void 0 ? _f : {})),
                            occurredAt: (_g = event.occurredAt) !== null && _g !== void 0 ? _g : new Date().toISOString(),
                        }),
                        keepalive: true,
                    })];
            case 2:
                _h.sent();
                return [2 /*return*/];
        }
    });
}); };
/**
 * Reports one client-side app error event when it is actionable.
 */
var reportAppError = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                if (shouldSkip(event))
                    return [2 /*return*/];
                return [4 /*yield*/, reportToApi(event)];
            case 1:
                _b.sent();
                return [3 /*break*/, 3];
            case 2:
                _a = _b.sent();
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.reportAppError = reportAppError;
/**
 * Installs global browser handlers for uncaught runtime errors and rejected promises.
 */
var installGlobalAppErrorHandlers = function () {
    if (typeof window === "undefined" || listenersInstalled) {
        return function () { return undefined; };
    }
    var onError = function (event) {
        var _a, _b, _c;
        var resolved = resolveMessageAndStack((_a = event.error) !== null && _a !== void 0 ? _a : event.message);
        void (0, exports.reportAppError)({
            source: "client.runtime",
            scope: "app",
            severity: "high",
            message: resolved.message,
            stack: resolved.stack,
            route: currentRoute(),
            metadata: {
                filename: normalizeText(event.filename, 260),
                lineno: (_b = event.lineno) !== null && _b !== void 0 ? _b : null,
                colno: (_c = event.colno) !== null && _c !== void 0 ? _c : null,
            },
        });
    };
    var onUnhandledRejection = function (event) {
        var resolved = resolveMessageAndStack(event.reason);
        void (0, exports.reportAppError)({
            source: "client.unhandledrejection",
            scope: "app",
            severity: "high",
            message: resolved.message,
            stack: resolved.stack,
            route: currentRoute(),
        });
    };
    listenersInstalled = true;
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return function () {
        listenersInstalled = false;
        window.removeEventListener("error", onError);
        window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
};
exports.installGlobalAppErrorHandlers = installGlobalAppErrorHandlers;
