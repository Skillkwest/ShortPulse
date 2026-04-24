/**
 * Reads and writes one user-owned project workspace snapshot for the authenticated caller.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { getProjectForUser, parseProjectId } from "../../../../lib/server/projectsService";
import {
  getProjectWorkspaceStateForUser,
  upsertProjectWorkspaceStateForUser,
} from "../../../../lib/server/projectWorkspaceStatesService";

type ProjectWorkspaceSuccessResponse = {
  workspace: {
    projectId: string;
    schemaVersion: number;
    snapshot: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  } | null;
};

type ProjectWorkspaceErrorResponse = {
  error: string;
  details?: string;
};

const toRequestBody = (value: unknown): Record<string, unknown> => {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const toOptionalSchemaVersion = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProjectWorkspaceSuccessResponse | ProjectWorkspaceErrorResponse>
) {
  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const projectId = parseProjectId(req.query.projectId);
  if (!projectId) {
    return res.status(400).json({ error: "Invalid project id" });
  }

  try {
    const requestBody = req.method === "PUT" ? toRequestBody(req.body) : null;
    const project = await getProjectForUser({
      userId: user.id,
      projectId,
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const workspace =
      req.method === "PUT"
        ? await upsertProjectWorkspaceStateForUser({
            userId: user.id,
            projectId,
            schemaVersion: toOptionalSchemaVersion(requestBody?.schemaVersion),
            snapshot: requestBody?.snapshot,
          })
        : await getProjectWorkspaceStateForUser({
            userId: user.id,
            projectId,
          });

    return res.status(200).json({
      workspace: workspace
        ? {
            projectId: workspace.projectId,
            schemaVersion: workspace.schemaVersion,
            snapshot: workspace.snapshot,
            createdAt: workspace.createdAt,
            updatedAt: workspace.updatedAt,
          }
        : null,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: req.method === "PUT" ? "projects-workspace-save" : "projects-workspace-read",
      user,
      metadata: {
        source:
          req.method === "PUT" ? "api.projects.workspace.save" : "api.projects.workspace.read",
      },
    });
    return res.status(500).json({
      error:
        req.method === "PUT"
          ? "Failed to save project workspace"
          : "Failed to load project workspace",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
