/**
 * Backstop status route for Kie.ai tasks.
 * Mirrors task-status to avoid 404s in dev environments.
 */
import handler from "./task-status";

export default handler;
