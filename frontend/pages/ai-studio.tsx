/**
 * AI Studio route entry.
 * Keeps the page chunk thin while the protected bootstrap gate resolves before
 * the full studio runtime loads from the feature module.
 */
import AiStudioProtectedRouteEntry from "../features/ai-studio/routes/AiStudioProtectedRouteEntry";

export default AiStudioProtectedRouteEntry;
