import { NextRequest, NextResponse } from "next/server";

type SupabaseUser = { id: string } | null;

const PROTECTED_API_PREFIXES = [
  "/api/fal/",
  "/api/kei/",
  "/api/ai/",
  "/api/upload-video",
  "/api/admin/",
  "/api/credits/",
  "/api/billing/credit-packages",
  "/api/billing/stripe/checkout",
  "/api/billing/stripe/portal",
];

const WEBHOOK_PATHS = new Set(["/api/billing/stripe/webhook"]);

const parseBearerToken = (authorizationHeader: string | null): string | null => {
  if (!authorizationHeader) return null;
  const [scheme, value] = authorizationHeader.split(" ");
  if (!scheme || !value) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return value.trim() || null;
};

const isProtectedApiPath = (pathname: string): boolean =>
  PROTECTED_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));

const unauthorized = () =>
  new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });

const getSupabaseUser = async (token: string): Promise<SupabaseUser> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { id?: string };
  if (!data?.id) return null;
  return { id: data.id };
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  if (WEBHOOK_PATHS.has(pathname)) {
    return NextResponse.next();
  }
  if (!isProtectedApiPath(pathname)) {
    return NextResponse.next();
  }

  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token) {
    return unauthorized();
  }

  const user = await getSupabaseUser(token);
  if (!user) {
    return unauthorized();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-shortpulse-user-id", user.id);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/api/:path*"],
};
