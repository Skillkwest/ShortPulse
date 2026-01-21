/**
 * Generates short random identifiers for client-only data.
 * Keeps ephemeral output IDs unique without round-tripping to a backend.
 */
export const randomId = () => Math.random().toString(36).slice(2);
