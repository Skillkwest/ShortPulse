/**
 * Lists user-owned projects for the authenticated caller.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { listProjectsForUser, parseProjectListLimit } from "../../../lib/server/projectsService";

type ProjectListResponse = {
  projects: Array<{
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

type ProjectListErrorResponse = {
  error: string;
  details?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProjectListResponse | ProjectListErrorResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  const limit = parseProjectListLimit(req.query.limit);
  if (limit == null) {
    return res.status(400).json({ error: "Invalid project list limit" });
  }

  try {
    const projects = await listProjectsForUser({
      userId: user.id,
      limit,
    });
    return res.status(200).json({
      projects: projects.map((project) => ({
        id: project.id,
        title: project.title,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })),
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "projects-list",
      user,
      metadata: {
        source: "api.projects.list",
      },
    });
    return res.status(500).json({
      error: "Failed to list projects",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
