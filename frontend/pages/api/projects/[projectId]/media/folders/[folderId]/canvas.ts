/**
 * Reads and writes one project-owned Media Library folder canvas snapshot.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../../../../lib/server/api/appErrorLogs";
import { parseMediaFolderCanvasSnapshot } from "../../../../../../../lib/server/mediaFolderCanvasService";
import { isCustomMediaFolderId } from "../../../../../../../lib/server/mediaFoldersService";
import {
  getProjectMediaFolderCanvasStateForUser,
  saveProjectMediaFolderCanvasStateForUser,
} from "../../../../../../../lib/server/projectMediaFolderCanvasService";
import { getProjectForUser, parseProjectId } from "../../../../../../../lib/server/projectsService";

type ProjectFolderCanvasResponse =
  | {
      state: {
        projectId: string;
        folderId: string;
        schemaVersion: number;
        snapshot: Record<string, unknown>;
        saveSeq: number;
        createdAt: string;
        updatedAt: string;
      } | null;
    }
  | {
      folderId: string;
      schemaVersion: number;
      saveSeq: number;
      createdAt: string;
      updatedAt: string;
    }
  | {
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
  res: NextApiResponse<ProjectFolderCanvasResponse>
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

  const folderId = typeof req.query.folderId === "string" ? req.query.folderId.trim() : "";
  if (!isCustomMediaFolderId(folderId)) {
    return res.status(400).json({ error: "Invalid folder id" });
  }

  try {
    const project = await getProjectForUser({ userId: user.id, projectId });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (req.method === "GET") {
      const state = await getProjectMediaFolderCanvasStateForUser({
        userId: user.id,
        projectId,
        folderId,
      });
      return res.status(200).json({
        state: state
          ? {
              projectId: state.projectId,
              folderId: state.folderId,
              schemaVersion: state.schemaVersion,
              snapshot: state.snapshot,
              saveSeq: state.saveSeq,
              createdAt: state.createdAt,
              updatedAt: state.updatedAt,
            }
          : null,
      });
    }

    const body = toRequestBody(req.body);
    const schemaVersion = toOptionalSchemaVersion(body.schemaVersion);
    const snapshot = parseMediaFolderCanvasSnapshot(body.snapshot);
    if (schemaVersion === undefined || !snapshot) {
      return res.status(400).json({ error: "Invalid folder canvas payload" });
    }

    const state = await saveProjectMediaFolderCanvasStateForUser({
      userId: user.id,
      projectId,
      folderId,
      schemaVersion,
      snapshot,
    });
    return res.status(200).json({
      folderId: state.folderId,
      schemaVersion: state.schemaVersion,
      saveSeq: state.saveSeq,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Folder not found") {
      return res.status(404).json({ error: "Folder not found" });
    }
    await logApiRouteException({
      req,
      error,
      routeLabel:
        req.method === "PUT"
          ? "projects-media-folder-canvas-save"
          : "projects-media-folder-canvas-read",
      user,
    });
    return res.status(500).json({
      error:
        req.method === "PUT"
          ? "Failed to save project folder canvas"
          : "Failed to load project folder canvas",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
