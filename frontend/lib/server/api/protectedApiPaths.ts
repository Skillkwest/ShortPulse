/**
 * Shared API path guards for proxy/middleware and route auth helpers.
 * Keeps protected-prefix routing rules centralized to avoid drift between layers.
 */
export const PROTECTED_API_PREFIXES = [
  "/api/fal/",
  "/api/ai/",
  "/api/media/",
  "/api/upload-video",
  "/api/upload-image",
  "/api/admin/",
  "/api/credits/",
  "/api/billing/credit-packages",
  "/api/billing/stripe/checkout",
  "/api/billing/stripe/portal",
];

export const WEBHOOK_PATHS = new Set(["/api/billing/stripe/webhook", "/api/fal/webhook"]);
const INTERNAL_API_PREFIXES = ["/api/_utils", "/api/_utils/"];

/**
 * Returns true when a route should be blocked from public direct access.
 */
export const isInternalApiPath = (pathname: string): boolean =>
  INTERNAL_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));

/**
 * Returns true when middleware/route auth must enforce an authenticated user.
 */
export const isProtectedApiPath = (pathname: string): boolean =>
  PROTECTED_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));

/**
 * Returns true when a route intentionally bypasses bearer-auth enforcement.
 */
export const isWebhookPath = (pathname: string): boolean => WEBHOOK_PATHS.has(pathname);
