import { getSupabaseAdmin } from "../api/supabaseAdmin";
import type { DeepLookupMode as LookupMode } from "./deep";

const AUTH_SEARCH_SCAN_PER_PAGE = 200;
const AUTH_SEARCH_SCAN_MAX_PAGES = 50;

export type AdminHealthAuthUser = {
  id: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const listUsersPage = async (
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  page: number,
  perPage: number
): Promise<{ users: AdminHealthAuthUser[]; nextPage: number | null }> => {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
  if (error) throw new Error(error.message);
  const users = Array.isArray(data?.users) ? (data.users as AdminHealthAuthUser[]) : [];
  const nextPage = typeof data?.nextPage === "number" ? data.nextPage : null;
  return { users, nextPage };
};

const findAuthUserByEmail = async (
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  email: string
): Promise<AdminHealthAuthUser | null> => {
  let page = 1;
  let hasNext = true;
  while (hasNext && page <= AUTH_SEARCH_SCAN_MAX_PAGES) {
    const pageResult = await listUsersPage(supabaseAdmin, page, AUTH_SEARCH_SCAN_PER_PAGE);
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

const findAuthUserById = async (
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string
): Promise<AdminHealthAuthUser | null> => {
  if (isUuid(userId)) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!error && data?.user && data.user.id === userId) {
      return data.user as AdminHealthAuthUser;
    }
  }

  let page = 1;
  let hasNext = true;
  while (hasNext && page <= AUTH_SEARCH_SCAN_MAX_PAGES) {
    const pageResult = await listUsersPage(supabaseAdmin, page, AUTH_SEARCH_SCAN_PER_PAGE);
    const found = pageResult.users.find((candidate) => String(candidate.id) === userId);
    if (found) return found;
    hasNext = pageResult.nextPage !== null && pageResult.nextPage > page;
    page += 1;
  }
  return null;
};

export const resolveAdminHealthAuthUser = async ({
  supabaseAdmin,
  lookup,
  lookupMode,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  lookup: string;
  lookupMode: LookupMode;
}): Promise<AdminHealthAuthUser | null> => {
  if (lookupMode === "email") {
    return findAuthUserByEmail(supabaseAdmin, lookup.toLowerCase());
  }
  if (lookupMode === "user_id") {
    return findAuthUserById(supabaseAdmin, lookup);
  }
  if (lookup.includes("@")) {
    return findAuthUserByEmail(supabaseAdmin, lookup.toLowerCase());
  }
  const userById = await findAuthUserById(supabaseAdmin, lookup);
  if (userById) return userById;
  if (lookup.includes("@")) {
    return findAuthUserByEmail(supabaseAdmin, lookup.toLowerCase());
  }
  return null;
};
