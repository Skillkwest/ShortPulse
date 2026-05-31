/**
 * AI Studio route entry.
 * Keeps the page chunk thin while the full studio runtime loads from the feature module.
 */
import dynamic from "next/dynamic";

const AiStudioRouteApp = dynamic(() => import("../features/ai-studio/routes/AiStudioRouteApp"));

export default AiStudioRouteApp;
