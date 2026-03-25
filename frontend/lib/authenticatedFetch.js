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
exports.fetchWithAuth = exports.isAuthSessionTimeoutError = exports.AUTH_SESSION_TIMEOUT_CODE = void 0;
/**
 * Browser fetch helper that attaches the current Supabase access token.
 * Use this for authenticated API routes so server handlers can enforce session checks.
 */
var supabaseClient_1 = require("./supabaseClient");
var appErrorReporter_1 = require("./appErrorReporter");
var clientBreadcrumbs_1 = require("./clientBreadcrumbs");
exports.AUTH_SESSION_TIMEOUT_CODE = "AUTH_SESSION_TIMEOUT";
var asHeaders = function (headers) {
    if (headers instanceof Headers)
        return new Headers(headers);
    return new Headers(headers !== null && headers !== void 0 ? headers : {});
};
var buildRequestId = function () {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return "sp_".concat(Date.now(), "_").concat(Math.random().toString(36).slice(2, 10));
};
var createAuthSessionTimeoutError = function (timeoutMs) {
    var error = new Error("Timed out resolving auth session after ".concat(Math.max(0, Math.trunc(timeoutMs)), "ms."));
    error.code = exports.AUTH_SESSION_TIMEOUT_CODE;
    error.timeoutMs = Math.max(0, Math.trunc(timeoutMs));
    return error;
};
var isAuthSessionTimeoutError = function (error) {
    if (!error || typeof error !== "object")
        return false;
    return error.code === exports.AUTH_SESSION_TIMEOUT_CODE;
};
exports.isAuthSessionTimeoutError = isAuthSessionTimeoutError;
var withTimeout = function (promise, timeoutMs) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, new Promise(function (resolve, reject) {
                    var timeoutId = setTimeout(function () {
                        reject(createAuthSessionTimeoutError(timeoutMs));
                    }, timeoutMs);
                    promise
                        .then(function (value) {
                        clearTimeout(timeoutId);
                        resolve(value);
                    })
                        .catch(function (error) {
                        clearTimeout(timeoutId);
                        reject(error);
                    });
                })];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
var readAccessToken = function (timeoutMs) { return __awaiter(void 0, void 0, void 0, function () {
    var supabase, sessionPromise, authSession, _a, data, error, error_1;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 5, , 6]);
                supabase = (0, supabaseClient_1.ensureSupabaseClient)();
                sessionPromise = supabase.auth.getSession();
                if (!(typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0)) return [3 /*break*/, 2];
                return [4 /*yield*/, withTimeout(sessionPromise, timeoutMs)];
            case 1:
                _a = _d.sent();
                return [3 /*break*/, 4];
            case 2: return [4 /*yield*/, sessionPromise];
            case 3:
                _a = _d.sent();
                _d.label = 4;
            case 4:
                authSession = _a;
                data = authSession.data, error = authSession.error;
                if (error)
                    return [2 /*return*/, null];
                return [2 /*return*/, (_c = (_b = data.session) === null || _b === void 0 ? void 0 : _b.access_token) !== null && _c !== void 0 ? _c : null];
            case 5:
                error_1 = _d.sent();
                if ((0, exports.isAuthSessionTimeoutError)(error_1)) {
                    throw error_1;
                }
                return [2 /*return*/, null];
            case 6: return [2 /*return*/];
        }
    });
}); };
var resolvePath = function (input) {
    if (typeof input === "string")
        return input;
    if (input instanceof URL)
        return "".concat(input.pathname).concat(input.search);
    if (typeof Request !== "undefined" && input instanceof Request)
        return input.url;
    return String(input);
};
var normalizeEndpoint = function (input) {
    var resolved = resolvePath(input);
    if (resolved.startsWith("/"))
        return resolved;
    try {
        var base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
        var parsed = new URL(resolved, base);
        return "".concat(parsed.pathname).concat(parsed.search);
    }
    catch (_a) {
        return resolved;
    }
};
var shouldLogHttpFailure = function (scope, endpoint, status) {
    if (!Number.isFinite(status))
        return false;
    // Admin routes can return 401/403 during expected auth/session transitions.
    // Keep these in UI/network breadcrumbs, but avoid escalating as incidents.
    if (endpoint.startsWith("/api/admin") && (status === 401 || status === 403)) {
        return false;
    }
    if (scope === "generation")
        return status >= 400;
    return status >= 400;
};
/**
 * Executes `fetch` with a bearer token from the active Supabase session.
 */
var fetchWithAuth = function (input, init) { return __awaiter(void 0, void 0, void 0, function () {
    var token, endpoint, scope, skipErrorLogging, headers, requestId, requestInit, startedAt, method, breadcrumbEndpoint, response, error_2;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, readAccessToken(init === null || init === void 0 ? void 0 : init.shortpulseAuthTimeoutMs)];
            case 1:
                token = _c.sent();
                if (!token) {
                    throw new Error("You must be signed in to call this endpoint.");
                }
                endpoint = normalizeEndpoint(input);
                scope = (_a = init === null || init === void 0 ? void 0 : init.shortpulseLogScope) !== null && _a !== void 0 ? _a : "app";
                skipErrorLogging = Boolean(init === null || init === void 0 ? void 0 : init.shortpulseSkipErrorLogging);
                headers = asHeaders(init === null || init === void 0 ? void 0 : init.headers);
                if (!headers.has("Authorization")) {
                    headers.set("Authorization", "Bearer ".concat(token));
                }
                if (!headers.has("x-shortpulse-request-id")) {
                    headers.set("x-shortpulse-request-id", buildRequestId());
                }
                requestId = headers.get("x-shortpulse-request-id");
                requestInit = __assign({}, (init !== null && init !== void 0 ? init : {}));
                delete requestInit.shortpulseLogScope;
                delete requestInit.shortpulseSkipErrorLogging;
                delete requestInit.shortpulseAuthTimeoutMs;
                startedAt = Date.now();
                method = ((_b = requestInit.method) !== null && _b !== void 0 ? _b : "GET").toString().toUpperCase();
                breadcrumbEndpoint = (0, clientBreadcrumbs_1.redactUrlForTelemetry)(endpoint);
                _c.label = 2;
            case 2:
                _c.trys.push([2, 4, , 5]);
                return [4 /*yield*/, fetch(input, __assign(__assign({}, requestInit), { headers: headers }))];
            case 3:
                response = _c.sent();
                (0, clientBreadcrumbs_1.addBreadcrumb)({
                    type: "network",
                    level: response.ok ? "info" : response.status >= 500 ? "error" : "warn",
                    message: "fetch",
                    data: {
                        method: method,
                        endpoint: breadcrumbEndpoint,
                        status: response.status,
                        duration_ms: Date.now() - startedAt,
                        request_id: requestId,
                    },
                });
                if (!skipErrorLogging &&
                    shouldLogHttpFailure(scope, endpoint, response.status) &&
                    !endpoint.includes("/api/log/client-error")) {
                    void (0, appErrorReporter_1.reportAppError)({
                        source: "client.api_response",
                        scope: scope,
                        severity: response.status >= 502 ? "high" : response.status >= 500 ? "medium" : "low",
                        message: "API ".concat(response.status, " response from ").concat(endpoint),
                        endpoint: endpoint,
                        requestId: requestId,
                        statusCode: response.status,
                        route: typeof window !== "undefined" ? window.location.pathname : null,
                        metadata: {
                            method: method,
                        },
                    });
                }
                return [2 /*return*/, response];
            case 4:
                error_2 = _c.sent();
                (0, clientBreadcrumbs_1.addBreadcrumb)({
                    type: "network",
                    level: "error",
                    message: "fetch_error",
                    data: {
                        method: method,
                        endpoint: breadcrumbEndpoint,
                        duration_ms: Date.now() - startedAt,
                        request_id: requestId,
                    },
                });
                if (!skipErrorLogging && !endpoint.includes("/api/log/client-error")) {
                    void (0, appErrorReporter_1.reportAppError)({
                        source: "client.api_network",
                        scope: scope,
                        severity: "high",
                        message: error_2 instanceof Error ? error_2.message : "Network request failed",
                        stack: error_2 instanceof Error ? error_2.stack : null,
                        endpoint: endpoint,
                        requestId: requestId,
                        route: typeof window !== "undefined" ? window.location.pathname : null,
                        metadata: {
                            method: method,
                        },
                    });
                }
                throw error_2;
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.fetchWithAuth = fetchWithAuth;
