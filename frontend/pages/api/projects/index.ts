/**
 * Lists user-owned projects for the authenticated caller.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  MAX_PROJECT_LIST_LIMIT,
  listProjectsForUser,
  parseProjectListLimit,
  parseProjectListOffset,
} from "../../../lib/server/projectsService";

type ProjectListResponse = {
  projects: Array<{
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    previewImageUrls: string[];
  }>;
  hasMore?: boolean;
  nextOffset?: number | null;
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
  const offset = parseProjectListOffset(req.query.offset);
  if (offset == null) {
    return res.status(400).json({ error: "Invalid project list offset" });
  }

  try {
    const pageLimit =
      typeof limit === "number" ? Math.min(limit + 1, MAX_PROJECT_LIST_LIMIT) : limit;
    const projects = await listProjectsForUser({
      userId: user.id,
      limit: pageLimit,
      offset,
    });
    const hasMore = typeof limit === "number" && projects.length > limit;
    const visibleProjects = typeof limit === "number" ? projects.slice(0, limit) : projects;
    return res.status(200).json({
      projects: visibleProjects.map((project) => ({
        id: project.id,
        title: project.title,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        previewImageUrls: project.previewImageUrls ?? [],
      })),
      hasMore,
      nextOffset: hasMore ? offset + visibleProjects.length : null,
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
    });
  }
}
