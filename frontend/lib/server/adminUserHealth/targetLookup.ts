import { getSupabaseAdmin } from "../api/supabaseAdmin";
import type { DeepLookupMode as LookupMode } from "./deep";

const AUTH_SEARCH_SCAN_PER_PAGE = 100;
const AUTH_SEARCH_SCAN_MAX_PAGES = 50;

export type AdminHealthAuthUser = {
  id: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const readAuthEnv = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin environment is not configured.");
  }
  return { supabaseUrl: supabaseUrl.replace(/\/+$/, ""), serviceRoleKey };
};

const authHeaders = (serviceRoleKey: string) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
});

const listUsersPageViaSdk = async (
  page: number,
  perPage: number
): Promise<{ users: AdminHealthAuthUser[]; nextPage: number | null } | null> => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const listUsers = supabaseAdmin.auth?.admin?.listUsers;
    if (typeof listUsers !== "function") {
      return null;
    }
    const response = await listUsers({ page, perPage } as never);
    const payload = response as
      | {
          data?: { users?: AdminHealthAuthUser[]; nextPage?: number | null };
          error?: unknown;
        }
      | undefined;
    if (payload?.error) {
      return null;
    }
    const users = Array.isArray(payload?.data?.users) ? (payload.data?.users ?? []) : [];
    const nextPage = typeof payload?.data?.nextPage === "number" ? payload.data.nextPage : null;
    return { users, nextPage };
  } catch {
    return null;
  }
};

const listUsersPage = async (
  page: number,
  perPage: number
): Promise<{ users: AdminHealthAuthUser[]; nextPage: number | null }> => {
  const { supabaseUrl, serviceRoleKey } = readAuthEnv();
  const endpoint = new URL("/auth/v1/admin/users", supabaseUrl);
  endpoint.searchParams.set("page", String(page));
  endpoint.searchParams.set("per_page", String(perPage));

  const response = await fetch(endpoint, {
    method: "GET",
    headers: authHeaders(serviceRoleKey),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Auth user list failed (${response.status}): ${body.slice(0, 240)}`);
  }

  const payload = await response.json();
  const users = Array.isArray(payload?.users) ? (payload.users as AdminHealthAuthUser[]) : [];
  const nextPage = typeof payload?.next_page === "number" ? payload.next_page : null;
  return { users, nextPage };
};

const findAuthUserByEmail = async (email: string): Promise<AdminHealthAuthUser | null> => {
  let page = 1;
  let hasNext = true;
  while (hasNext && page <= AUTH_SEARCH_SCAN_MAX_PAGES) {
    const pageResult =
      (await listUsersPageViaSdk(page, AUTH_SEARCH_SCAN_PER_PAGE)) ??
      (await listUsersPage(page, AUTH_SEARCH_SCAN_PER_PAGE));
    const found = pageResult.users.find(
      (candidate) =>
        String(candidate.email ?? "")
          .trim()
          .toLowerCase() === email
    );
    if (found) return found;
    hasNext = pageResult.nextPage !== null && pageResult.nextPage > page;
    page += 1;
  }
  return null;
};

const findAuthUserById = async (userId: string): Promise<AdminHealthAuthUser | null> => {
  const { supabaseUrl, serviceRoleKey } = readAuthEnv();

  if (isUuid(userId)) {
    const endpoint = new URL(`/auth/v1/admin/users/${userId}`, supabaseUrl);
    const response = await fetch(endpoint, {
      method: "GET",
      headers: authHeaders(serviceRoleKey),
    });
    if (response.ok) {
      const payload = await response.json();
      if (payload?.user && payload.user.id === userId) {
        return payload.user as AdminHealthAuthUser;
      }
    }
  }

  let page = 1;
  let hasNext = true;
  while (hasNext && page <= AUTH_SEARCH_SCAN_MAX_PAGES) {
    const pageResult =
      (await listUsersPageViaSdk(page, AUTH_SEARCH_SCAN_PER_PAGE)) ??
      (await listUsersPage(page, AUTH_SEARCH_SCAN_PER_PAGE));
    const found = pageResult.users.find((candidate) => String(candidate.id) === userId);
    if (found) return found;
    hasNext = pageResult.nextPage !== null && pageResult.nextPage > page;
    page += 1;
  }
  return null;
};

export const resolveAdminHealthAuthUser = async ({
  lookup,
  lookupMode,
}: {
  lookup: string;
  lookupMode: LookupMode;
}): Promise<AdminHealthAuthUser | null> => {
  if (lookupMode === "email") {
    return findAuthUserByEmail(lookup.toLowerCase());
  }
  if (lookupMode === "user_id") {
    return findAuthUserById(lookup);
  }
  if (lookup.includes("@")) {
    return findAuthUserByEmail(lookup.toLowerCase());
  }
  const userById = await findAuthUserById(lookup);
  if (userById) return userById;
  if (lookup.includes("@")) {
    return findAuthUserByEmail(lookup.toLowerCase());
  }
  return null;
};
