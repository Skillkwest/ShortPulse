/**
 * Dispatches dynamic project API routes through a single Pages API entrypoint.
 *
 * Next dev/Turbopack can miss nested `pages/api/projects/[projectId]/...`
 * routes in this repo shape. Keep one dynamic route in `pages/api`, and keep
 * the focused handler implementations in `lib/server/projectApiRoutes`.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import itemHandler from "../../../lib/server/projectApiRoutes/item";
import workspaceHandler from "../../../lib/server/projectApiRoutes/workspace";
import folderCanvasHandler from "../../../lib/server/projectApiRoutes/mediaFolders/canvas";
import folderCreateHandler from "../../../lib/server/projectApiRoutes/mediaFolders/create";
import folderDeleteHandler from "../../../lib/server/projectApiRoutes/mediaFolders/delete";
import folderListHandler from "../../../lib/server/projectApiRoutes/mediaFolders/list";
import folderMembershipBatchHandler from "../../../lib/server/projectApiRoutes/mediaFolders/membership-batch";
import folderMoveHandler from "../../../lib/server/projectApiRoutes/mediaFolders/move";
import folderRenameHandler from "../../../lib/server/projectApiRoutes/mediaFolders/rename";

type ProjectDynamicRouteHandler = (req: NextApiRequest, res: NextApiResponse) => unknown;

type ResolvedProjectDynamicRoute = {
  kind:
    | "item"
    | "workspace"
    | "media-folders-list"
    | "media-folders-create"
    | "media-folders-delete"
    | "media-folders-membership-batch"
    | "media-folders-move"
    | "media-folders-rename"
    | "media-folder-canvas";
  handler: ProjectDynamicRouteHandler;
  query: Record<string, string>;
};

const toRouteSegments = (value: string | string[] | undefined): string[] => {
  if (Array.isArray(value)) return value.map((entry) => entry.trim()).filter(Boolean);
  if (typeof value === "string") return [value.trim()].filter(Boolean);
  return [];
};

const withRouteQuery = (req: NextApiRequest, query: Record<string, string>): NextApiRequest => {
  req.query = query;
  return req;
};

const dispatchHandler = (
  handler: ProjectDynamicRouteHandler,
  req: NextApiRequest,
  res: NextApiResponse
) => handler(req, res);

export const resolveProjectDynamicRoute = (
  segments: string[]
): ResolvedProjectDynamicRoute | null => {
  const projectId = segments[0];
  if (!projectId) return null;

  if (segments.length === 1) {
    return { kind: "item", handler: itemHandler, query: { projectId } };
  }

  if (segments.length === 2 && segments[1] === "workspace") {
    return { kind: "workspace", handler: workspaceHandler, query: { projectId } };
  }

  if (segments[1] !== "media" || segments[2] !== "folders") {
    return null;
  }

  const folderAction = segments[3];
  if (segments.length === 4) {
    const folderRoutes: Record<string, Pick<ResolvedProjectDynamicRoute, "kind" | "handler">> = {
      create: { kind: "media-folders-create", handler: folderCreateHandler },
      delete: { kind: "media-folders-delete", handler: folderDeleteHandler },
      list: { kind: "media-folders-list", handler: folderListHandler },
      "membership-batch": {
        kind: "media-folders-membership-batch",
        handler: folderMembershipBatchHandler,
      },
      move: { kind: "media-folders-move", handler: folderMoveHandler },
      rename: { kind: "media-folders-rename", handler: folderRenameHandler },
    };
    const folderRoute = folderRoutes[folderAction];
    if (!folderRoute) return null;
    return {
      ...folderRoute,
      query: { projectId },
    };
  }

  if (segments.length === 5 && folderAction && segments[4] === "canvas") {
    return {
      kind: "media-folder-canvas",
      handler: folderCanvasHandler,
      query: { projectId, folderId: folderAction },
    };
  }

  return null;
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const segments = toRouteSegments(req.query.projectPath);
  const route = resolveProjectDynamicRoute(segments);
  if (route) {
    return dispatchHandler(route.handler, withRouteQuery(req, route.query), res);
  }

  return res.status(404).json({ error: "Not found" });
}
