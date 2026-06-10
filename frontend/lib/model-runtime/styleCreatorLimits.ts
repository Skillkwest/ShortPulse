/**
 * Shared style-creator limits used by client feature code and server routes.
 * Keeping these outside UI component folders prevents API/runtime routes from
 * importing presentation-layer modules for billing-adjacent validation.
 */
export const STYLE_PROMPT_MAX_CHARACTERS = 1000;
export const STYLE_PROMPT_NEAR_LIMIT_CHARACTERS = 900;
