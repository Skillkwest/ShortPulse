/**
 * Reads one user-owned project for the authenticated caller.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  getProjectForUser,
  parseProjectId,
  updateProjectTitleForUser,
} from "../../../lib/server/projectsService";

type ProjectResponse = {
  project: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  };
};

type ProjectErrorResponse = {
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProjectResponse | ProjectErrorResponse>
) {
  if (req.method !== "GET" && req.method !== "PATCH") {
    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const projectId = parseProjectId(req.query.projectId);
  if (!projectId) {
    return res.status(400).json({ error: "Invalid project id" });
  }

  try {
    const project =
      req.method === "PATCH"
        ? await updateProjectTitleForUser({
            userId: user.id,
            projectId,
            title: toRequestBody(req.body).title,
          })
        : await getProjectForUser({
            userId: user.id,
            projectId,
          });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    return res.status(200).json({
      project: {
        id: project.id,
        title: project.title,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: req.method === "PATCH" ? "projects-update" : "projects-read",
      user,
      metadata: {
        source: req.method === "PATCH" ? "api.projects.update" : "api.projects.read",
      },
    });
    return res.status(500).json({
      error: req.method === "PATCH" ? "Failed to update project" : "Failed to load project",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
