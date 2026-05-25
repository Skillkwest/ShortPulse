/**
 * Reads and writes one user-owned project workspace snapshot for the authenticated caller.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../api/auth";
import { logApiRouteException } from "../api/appErrorLogs";
import { getProjectForUser, parseProjectId } from "../projectsService";
import {
  deleteProjectWorkspaceStateForUser,
  getProjectWorkspaceStateForUser,
  InvalidProjectWorkspaceSnapshotError,
  type ProjectWorkspaceSaveOutcome,
  upsertProjectWorkspaceStateForUser,
} from "../projectWorkspaceStatesService";

type ProjectWorkspaceSuccessResponse = {
  workspace: {
    projectId: string;
    schemaVersion: number;
    snapshot: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  } | null;
  saveOutcome?: ProjectWorkspaceSaveOutcome;
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

const resolveWorkspaceRouteLabel = (
  method: NextApiRequest["method"]
): "projects-workspace-save" | "projects-workspace-read" | "projects-workspace-delete" => {
  if (method === "PUT") return "projects-workspace-save";
  if (method === "DELETE") return "projects-workspace-delete";
  return "projects-workspace-read";
};

const resolveWorkspaceErrorMessage = (method: NextApiRequest["method"]): string => {
  if (method === "PUT") return "Failed to save project workspace";
  if (method === "DELETE") return "Failed to reset project workspace";
  return "Failed to load project workspace";
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProjectWorkspaceSuccessResponse | ProjectWorkspaceErrorResponse>
) {
  let user: Awaited<ReturnType<typeof requireApiUser>> | null = null;
  try {
    if (req.method !== "GET" && req.method !== "PUT" && req.method !== "DELETE") {
      res.setHeader("Allow", "GET, PUT, DELETE");
      return res.status(405).json({ error: "Method not allowed" });
    }

    user = await requireApiUser(req, res);
    if (!user) return;

    const projectId = parseProjectId(req.query.projectId);
    if (!projectId) {
      return res.status(400).json({ error: "Invalid project id" });
    }

    const requestBody = req.method === "PUT" ? toRequestBody(req.body) : null;
    const project = await getProjectForUser({
      userId: user.id,
      projectId,
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (req.method === "DELETE") {
      await deleteProjectWorkspaceStateForUser({
        userId: user.id,
        projectId,
      });
      return res.status(200).json({ workspace: null });
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
      ...(workspace?.saveOutcome ? { saveOutcome: workspace.saveOutcome } : {}),
    });
  } catch (error) {
    if (res.headersSent || res.writableEnded) return;
    if (error instanceof InvalidProjectWorkspaceSnapshotError) {
      return res.status(400).json({
        error: "Invalid project workspace snapshot",
        details: error.message,
      });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel: resolveWorkspaceRouteLabel(req.method),
      user,
      metadata: {
        source:
          req.method === "PUT"
            ? "api.projects.workspace.save"
            : req.method === "DELETE"
              ? "api.projects.workspace.delete"
              : "api.projects.workspace.read",
      },
    });
    return res.status(500).json({
      error: resolveWorkspaceErrorMessage(req.method),
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
