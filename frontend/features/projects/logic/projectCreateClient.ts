/**
 * Authenticated client helper for creating user-owned projects.
 * Centralizes request/response parsing for dashboard and AI Studio entry points.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";

export const DEFAULT_NEW_PROJECT_TITLE = "Untitled project";

export type CreatedProjectRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type CreateProjectPayload = {
  project?: Partial<CreatedProjectRecord> | null;
  error?: string;
  details?: string;
};

const toCreatedProjectRecord = (value: Partial<CreatedProjectRecord> | null | undefined) => {
  if (!value?.id) return null;
  return {
    id: value.id,
    title: typeof value.title === "string" ? value.title : DEFAULT_NEW_PROJECT_TITLE,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
  } satisfies CreatedProjectRecord;
};

/**
 * Creates a project for the authenticated caller.
 * Returns the normalized project record or throws with a user-facing message.
 */
export const createProject = async (title: string): Promise<CreatedProjectRecord> => {
  const response = await fetchWithAuth("/api/projects/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  });
  const payload = (await response.json().catch(() => ({}))) as CreateProjectPayload;
  const project = toCreatedProjectRecord(payload.project);
  if (!response.ok || !project) {
    throw new Error(payload.error || payload.details || "Failed to create project.");
  }
  return project;
};
