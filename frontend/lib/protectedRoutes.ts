/**
 * Canonical protected-route path helpers.
 * Kept separate from auth hooks so route classification can stay lightweight in
 * public entry points like the shared app shell.
 */
export const PROTECTED_ROUTES = [
  "/saved-creators",
  "/profile",
  "/report-issue",
  "/ai-studio",
  "/admin",
] as const;

/**
 * Determines whether a pathname belongs to a protected route surface.
 */
export const isProtectedRoutePath = (pathname: string): boolean =>
  PROTECTED_ROUTES.some((route) => pathname.startsWith(route));

/**
 * Determines whether a pathname belongs to the AI Studio route family.
 */
export const isAiStudioRoutePath = (pathname: string): boolean => pathname.startsWith("/ai-studio");
