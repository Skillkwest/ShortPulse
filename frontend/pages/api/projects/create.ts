/**
 * Creates a user-owned project for the authenticated caller.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { enforceApiRateLimit } from "../../../lib/server/api/rateLimit";
import { createProjectForUser } from "../../../lib/server/projectsService";

type CreateProjectSuccessResponse = {
  project: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  };
};

type CreateProjectErrorResponse = {
  error: string;
  details?: string;
};

const PROJECT_CREATE_RATE_LIMIT = {
  keyPrefix: "projects-create",
  maxRequests: 12,
  windowMs: 10 * 60 * 1000,
} as const;

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
  res: NextApiResponse<CreateProjectSuccessResponse | CreateProjectErrorResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "projects-create.auth",
      scope: "app",
    });
    return res.status(500).json({
      error: "Failed to create project",
    });
  }
  if (!user) return;
  if (
    !enforceApiRateLimit(req, res, {
      ...PROJECT_CREATE_RATE_LIMIT,
      keyPrefix: `${PROJECT_CREATE_RATE_LIMIT.keyPrefix}:${user.id}`,
    })
  ) {
    return;
  }

  try {
    const body = toRequestBody(req.body);
    const project = await createProjectForUser({
      userId: user.id,
      title: body.title,
    });

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
      routeLabel: "projects-create",
      user,
      metadata: {
        source: "api.projects.create",
      },
    });
    return res.status(500).json({
      error: "Failed to create project",
    });
  }
}
