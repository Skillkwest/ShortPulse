import { NextRequest, NextResponse } from "next/server";
import {
  isDisabledApiPath,
  isInternalApiPath,
  isProtectedApiPath,
  isWebhookPath,
} from "./lib/server/api/protectedApiPaths";
import {
  fetchSupabaseUser,
  parseBearerToken,
  type AuthenticatedApiUser,
} from "./lib/server/api/authTokenVerifier";

const unauthorized = () =>
  new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });

const authVerificationUnavailable = () =>
  new NextResponse(
    JSON.stringify({
      error: "Authentication verification is temporarily unavailable.",
      code: "AUTH_VERIFICATION_UNAVAILABLE",
    }),
    {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }
  );

const proxyRuntimeFailure = () =>
  new NextResponse(
    JSON.stringify({
      error: "Protected API proxy failed.",
      code: "AUTH_PROXY_RUNTIME_FAILURE",
    }),
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }
  );

const notFound = () =>
  new NextResponse(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });

export async function proxy(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    if (!pathname.startsWith("/api/")) {
      return NextResponse.next();
    }
    if (isDisabledApiPath(pathname)) {
      return notFound();
    }
    if (isInternalApiPath(pathname)) {
      return notFound();
    }
    if (isWebhookPath(pathname)) {
      return NextResponse.next();
    }
    if (!isProtectedApiPath(pathname)) {
      return NextResponse.next();
    }

    const token = parseBearerToken(request.headers.get("authorization"));
    if (!token) {
      return unauthorized();
    }

    let user: AuthenticatedApiUser | null = null;
    try {
      user = await fetchSupabaseUser(token);
    } catch (error) {
      console.error("[proxy] Supabase auth lookup failed", error);
      return authVerificationUnavailable();
    }
    if (!user) {
      return unauthorized();
    }

    const requestHeaders = new Headers(request.headers);
    const encodedAppMetadata = encodeURIComponent(JSON.stringify(user.app_metadata ?? {}));
    const encodedUserMetadata = encodeURIComponent(JSON.stringify(user.user_metadata ?? {}));
    requestHeaders.set("x-shortpulse-authenticated", "1");
    requestHeaders.set("x-shortpulse-user-id", user.id);
    requestHeaders.set("x-shortpulse-user-email", user.email ?? "");
    requestHeaders.set("x-shortpulse-user-app-metadata", encodedAppMetadata);
    requestHeaders.set("x-shortpulse-user-user-metadata", encodedUserMetadata);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error("[proxy] Protected API proxy runtime failure", {
      pathname: request.nextUrl.pathname,
      requestId: request.headers.get("x-shortpulse-request-id"),
      error,
    });
    return proxyRuntimeFailure();
  }
}

export const config = {
  matcher: ["/api/:path*"],
};
