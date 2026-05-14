import { NextRequest, NextResponse } from "next/server";
import {
  isInternalApiPath,
  isProtectedApiPath,
  isWebhookPath,
} from "./lib/server/api/protectedApiPaths";

type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
} | null;

const parseBearerToken = (authorizationHeader: string | null): string | null => {
  if (!authorizationHeader) return null;
  const [scheme, value] = authorizationHeader.split(" ");
  if (!scheme || !value) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return value.trim() || null;
};

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

const notFound = () =>
  new NextResponse(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });

const getSupabaseUser = async (token: string): Promise<SupabaseUser> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Authentication verification is unavailable.");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    throw new Error(`Authentication verification failed with ${response.status}.`);
  }
  const data = (await response.json()) as {
    id?: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
    app_metadata?: Record<string, unknown>;
  };
  if (!data?.id) return null;
  return {
    id: data.id,
    email: data.email,
    user_metadata: data.user_metadata,
    app_metadata: data.app_metadata,
  };
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
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

  let user: SupabaseUser = null;
  try {
    user = await getSupabaseUser(token);
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
}

export const config = {
  matcher: ["/api/:path*"],
};
