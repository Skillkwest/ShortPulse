/**
 * Dispatches dynamic project API routes through a single Pages API entrypoint.
 *
 * Next dev/Turbopack can miss nested `pages/api/projects/[projectId]/...`
 * routes in this repo shape. Keep one dynamic route in `pages/api`, and keep
 * the focused handler implementations in `lib/server/projectApiRoutes`.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { RequestBodyTooLargeError, readRawRequestBody } from "../../../lib/server/api/requestBody";
import { logApiRouteException, writeAppErrorLog } from "../../../lib/server/api/appErrorLogs";
import itemHandler from "../../../lib/server/projectApiRoutes/item";
import workspaceHandler from "../../../lib/server/projectApiRoutes/workspace";
import { PROJECT_WORKSPACE_ROUTE_BODY_LIMIT_BYTES } from "../../../lib/ai-studio-session/projectWorkspaceLimits";

type ProjectDynamicRouteHandler = (req: NextApiRequest, res: NextApiResponse) => unknown;

type ResolvedProjectDynamicRoute = {
  kind: "item" | "workspace";
  handler: ProjectDynamicRouteHandler;
  query: Record<string, string>;
};

class InvalidDynamicProjectRouteBodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDynamicProjectRouteBodyError";
  }
}

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

const resolveRequestContentType = (req: NextApiRequest): string | null => {
  const rawHeader = req.headers["content-type"];
  const value = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (typeof value !== "string") return null;
  const normalized = value.split(";")[0]?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
};

const requestBodyCanBeSkipped = (req: NextApiRequest): boolean =>
  req.method === "GET" || req.method === "HEAD" || req.body !== undefined;

const parseDynamicProjectRouteBody = ({
  rawBody,
  contentType,
}: {
  rawBody: string;
  contentType: string | null;
}): unknown => {
  const trimmed = rawBody.trim();
  if (!trimmed) return {};

  const shouldParseJson =
    contentType === "application/json" ||
    contentType === "application/ld+json" ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    trimmed.startsWith('"');

  if (!shouldParseJson) return rawBody;

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new InvalidDynamicProjectRouteBodyError("Invalid JSON request body.");
  }
};

const hydrateDynamicProjectRouteBody = async (req: NextApiRequest): Promise<void> => {
  if (requestBodyCanBeSkipped(req)) return;

  const contentLengthHeader = req.headers["content-length"];
  const contentLength = Array.isArray(contentLengthHeader)
    ? contentLengthHeader[0]
    : contentLengthHeader;
  if (contentLength === "0") {
    req.body = {};
    return;
  }

  const rawBody = await readRawRequestBody(req, {
    maxBytes: PROJECT_WORKSPACE_ROUTE_BODY_LIMIT_BYTES,
  });
  req.body = parseDynamicProjectRouteBody({
    rawBody,
    contentType: resolveRequestContentType(req),
  });
};

const resolveDynamicRouteExceptionLabel = ({
  kind,
  method,
}: {
  kind: ResolvedProjectDynamicRoute["kind"];
  method: NextApiRequest["method"];
}): string => {
  if (kind === "workspace") {
    if (method === "PUT") return "projects-workspace-save-dispatch";
    if (method === "DELETE") return "projects-workspace-delete-dispatch";
    return "projects-workspace-read-dispatch";
  }
  if (kind === "item") {
    if (method === "PATCH") return "projects-item-update-dispatch";
    if (method === "DELETE") return "projects-item-delete-dispatch";
    return "projects-item-read-dispatch";
  }
  return `projects-${kind}-dispatch`;
};

const resolveDynamicRouteBodyEventLabel = ({
  kind,
  method,
}: {
  kind: ResolvedProjectDynamicRoute["kind"];
  method: NextApiRequest["method"];
}): string => {
  if (kind === "workspace") {
    if (method === "PUT") return "projects-workspace-save-request-body";
    if (method === "DELETE") return "projects-workspace-delete-request-body";
    return "projects-workspace-read-request-body";
  }
  if (kind === "item") {
    if (method === "PATCH") return "projects-item-update-request-body";
    if (method === "DELETE") return "projects-item-delete-request-body";
    return "projects-item-read-request-body";
  }
  return `projects-${kind}-request-body`;
};

const resolveDynamicRouteErrorResponse = ({
  kind,
  method,
}: {
  kind: ResolvedProjectDynamicRoute["kind"];
  method: NextApiRequest["method"];
}): { error: string; details?: string; failureStage?: string } | { error: string } => {
  if (kind === "workspace") {
    if (method === "PUT") {
      return {
        error: "Failed to save project workspace",
        details:
          "Failed to save project workspace during dynamic route dispatch: Internal Server Error",
        failureStage: "workspace save",
      };
    }
    if (method === "DELETE") {
      return {
        error: "Failed to reset project workspace",
        details:
          "Failed to reset project workspace during dynamic route dispatch: Internal Server Error",
        failureStage: "workspace delete",
      };
    }
    return {
      error: "Failed to load project workspace",
      details:
        "Failed to load project workspace during dynamic route dispatch: Internal Server Error",
      failureStage: "workspace read",
    };
  }

  return {
    error: "Failed to process project route",
  };
};

const resolveDynamicRouteBodyErrorResponse = ({
  kind,
  method,
  error,
}: {
  kind: ResolvedProjectDynamicRoute["kind"];
  method: NextApiRequest["method"];
  error: unknown;
}): {
  status: number;
  payload:
    | { error: string; details?: string; failureStage?: string }
    | { error: string; details?: string };
} => {
  const requestBodyMessage =
    error instanceof RequestBodyTooLargeError
      ? `Project request body exceeds ${error.maxBytes} bytes.`
      : error instanceof InvalidDynamicProjectRouteBodyError
        ? error.message
        : "Invalid project request body.";

  if (kind === "workspace") {
    if (method === "PUT") {
      return {
        status: error instanceof RequestBodyTooLargeError ? 413 : 400,
        payload: {
          error: requestBodyMessage,
          details: "Failed to save project workspace during request body handling.",
          failureStage: "request body",
        },
      };
    }
    if (method === "DELETE") {
      return {
        status: error instanceof RequestBodyTooLargeError ? 413 : 400,
        payload: {
          error: requestBodyMessage,
          details: "Failed to reset project workspace during request body handling.",
          failureStage: "request body",
        },
      };
    }
    return {
      status: error instanceof RequestBodyTooLargeError ? 413 : 400,
      payload: {
        error: requestBodyMessage,
        details: "Failed to load project workspace during request body handling.",
        failureStage: "request body",
      },
    };
  }

  return {
    status: error instanceof RequestBodyTooLargeError ? 413 : 400,
    payload: {
      error: requestBodyMessage,
      details: "Failed to process project route during request body handling.",
    },
  };
};

const logDynamicRouteBodyFailure = async ({
  req,
  route,
  segments,
  error,
}: {
  req: NextApiRequest;
  route: ResolvedProjectDynamicRoute;
  segments: string[];
  error: RequestBodyTooLargeError | InvalidDynamicProjectRouteBodyError;
}): Promise<void> => {
  const routeLabel = resolveDynamicRouteBodyEventLabel({
    kind: route.kind,
    method: req.method,
  });

  try {
    await writeAppErrorLog({
      source: "telemetry.api.projects.dynamic_route.request_body_failure",
      scope: "app",
      severity: error instanceof RequestBodyTooLargeError ? "medium" : "low",
      message:
        error instanceof RequestBodyTooLargeError
          ? "Project dynamic route request body exceeded configured limit."
          : "Project dynamic route request body was invalid.",
      route: routeLabel,
      endpoint: req.url ?? null,
      statusCode: error instanceof RequestBodyTooLargeError ? 413 : 400,
      metadata: {
        method: req.method ?? null,
        route_label: routeLabel,
        source: "api.projects.dynamic_request_body",
        project_dynamic_route_kind: route.kind,
        project_dynamic_route_segments: segments,
        request_body_failure_kind:
          error instanceof RequestBodyTooLargeError
            ? "request_body_too_large"
            : "invalid_request_body",
        request_body_content_type: resolveRequestContentType(req),
        request_body_limit_bytes:
          error instanceof RequestBodyTooLargeError ? error.maxBytes : undefined,
      },
    });
  } catch (loggingError) {
    console.error("[projects dynamic route] request body failure log write failed", loggingError);
  }
};

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
  return null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const segments = toRouteSegments(req.query.projectPath);
  const route = resolveProjectDynamicRoute(segments);
  if (route) {
    try {
      await hydrateDynamicProjectRouteBody(req);
      return await dispatchHandler(route.handler, withRouteQuery(req, route.query), res);
    } catch (error) {
      if (
        error instanceof RequestBodyTooLargeError ||
        error instanceof InvalidDynamicProjectRouteBodyError
      ) {
        await logDynamicRouteBodyFailure({
          req,
          route,
          segments,
          error,
        });
        if (res.headersSent || res.writableEnded) return;
        const bodyErrorResponse = resolveDynamicRouteBodyErrorResponse({
          kind: route.kind,
          method: req.method,
          error,
        });
        return res.status(bodyErrorResponse.status).json(bodyErrorResponse.payload);
      }
      await logApiRouteException({
        req,
        error,
        routeLabel: resolveDynamicRouteExceptionLabel({
          kind: route.kind,
          method: req.method,
        }),
        metadata: {
          project_dynamic_route_kind: route.kind,
          project_dynamic_route_segments: segments,
          source: "api.projects.dynamic_dispatch",
        },
      });
      if (res.headersSent || res.writableEnded) return;
      return res.status(500).json(
        resolveDynamicRouteErrorResponse({
          kind: route.kind,
          method: req.method,
        })
      );
    }
  }

  return res.status(404).json({ error: "Not found" });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
