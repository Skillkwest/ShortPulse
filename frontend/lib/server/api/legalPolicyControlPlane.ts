/**
 * Server-side legal policy control plane.
 * Owns runtime reads, bootstrap from seed markdown, and admin publication for public legal pages.
 */
import fs from "fs/promises";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LEGAL_POLICY_SLUGS,
  LEGAL_POLICY_SOURCES,
  type LegalPolicySlug,
} from "../../../features/legal/data/legalPolicies";
import { asNullableString, hasSupabaseAdminConfig } from "./controlPlaneCatalogCore";
import { getSupabaseAdmin } from "./supabaseAdmin";

export type LegalPolicyDocumentSource = "control_plane" | "seed";

export type LegalPolicyDocument = {
  slug: LegalPolicySlug;
  markdown: string;
  version: number | null;
  versionId: number | null;
  note: string | null;
  source: LegalPolicyDocumentSource;
  updatedAt: string | null;
  updatedByEmail: string | null;
};

export type LegalPolicyAdminDocument = LegalPolicyDocument & {
  degraded: boolean;
  history: LegalPolicyVersionSummary[];
};

export type LegalPolicyVersionSummary = {
  version: number;
  versionId: number;
  note: string | null;
  createdAt: string | null;
  createdByEmail: string | null;
  isActive: boolean;
};

type LegalPolicyVersionRow = {
  id: number;
  version: number;
};

type LegalPolicyRpcRow = Record<string, unknown>;

export class LegalPolicyUnavailableError extends Error {
  constructor(slug: LegalPolicySlug) {
    super(`Legal policy ${slug} is unavailable from the control plane.`);
    this.name = "LegalPolicyUnavailableError";
  }
}

export class LegalPolicyVersionMismatchError extends Error {
  constructor(slug: LegalPolicySlug) {
    super(`Legal policy ${slug} changed since it was loaded.`);
    this.name = "LegalPolicyVersionMismatchError";
  }
}

const DEFAULT_LEGAL_POLICY_CACHE_TTL_MS = 5000;
const LEGAL_POLICY_MAX_MARKDOWN_LENGTH = 250_000;

let publicPolicyCache: Partial<
  Record<
    LegalPolicySlug,
    {
      expiresAtMs: number;
      value: LegalPolicyDocument;
    }
  >
> = {};

const asNullableNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeRpcRow = (payload: unknown): LegalPolicyRpcRow | null => {
  if (Array.isArray(payload)) {
    const first = payload[0];
    return first && typeof first === "object" && !Array.isArray(first)
      ? (first as LegalPolicyRpcRow)
      : null;
  }
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as LegalPolicyRpcRow)
    : null;
};

const resolveLegalPolicyCacheTtlMs = (rawValue?: string | null): number => {
  const parsed = Number(rawValue ?? String(DEFAULT_LEGAL_POLICY_CACHE_TTL_MS));
  if (!Number.isFinite(parsed)) return DEFAULT_LEGAL_POLICY_CACHE_TTL_MS;
  return Math.max(1000, Math.min(60000, Math.floor(parsed)));
};

const readSeedMarkdown = async (slug: LegalPolicySlug): Promise<string> => {
  const policy = LEGAL_POLICY_SOURCES[slug];
  const filePath = path.join(process.cwd(), "content", "legal", policy.contentFileName);
  return fs.readFile(filePath, "utf8");
};

const normalizeMarkdown = (markdown: string): string => {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    throw new Error("Legal policy markdown cannot be empty.");
  }
  if (normalized.length > LEGAL_POLICY_MAX_MARKDOWN_LENGTH) {
    throw new Error("Legal policy markdown is too large.");
  }
  return `${normalized}\n`;
};

const buildSeedPolicyDocument = async (slug: LegalPolicySlug): Promise<LegalPolicyDocument> => ({
  slug,
  markdown: await readSeedMarkdown(slug),
  version: null,
  versionId: null,
  note: "seed_markdown",
  source: "seed",
  updatedAt: null,
  updatedByEmail: null,
});

const mapActivePolicy = (
  slug: LegalPolicySlug,
  row: LegalPolicyRpcRow | null
): LegalPolicyDocument | null => {
  const markdown = asNullableString(row?.markdown);
  const version = asNullableNumber(row?.active_policy_version);
  const versionId = asNullableNumber(row?.active_policy_version_id);
  if (!row || !markdown || version == null || versionId == null) {
    return null;
  }

  return {
    slug,
    markdown,
    version,
    versionId,
    note: asNullableString(row.note),
    source: "control_plane",
    updatedAt: asNullableString(row.updated_at),
    updatedByEmail: asNullableString(row.updated_by_email),
  };
};

const fetchActiveLegalPolicy = async ({
  slug,
  supabaseAdmin = getSupabaseAdmin(),
}: {
  slug: LegalPolicySlug;
  supabaseAdmin?: SupabaseClient;
}): Promise<LegalPolicyDocument | null> => {
  const { data, error } = await supabaseAdmin.rpc("get_active_legal_policy", {
    p_slug: slug,
  });
  if (error) {
    throw new Error(error.message || `Failed to load active legal policy ${slug}.`);
  }
  return mapActivePolicy(slug, normalizeRpcRow(data));
};

const ensureLegalPolicyInitialized = async ({
  slug,
  supabaseAdmin = getSupabaseAdmin(),
  actorUserId = null,
  actorEmail = "system_seed",
}: {
  slug: LegalPolicySlug;
  supabaseAdmin?: SupabaseClient;
  actorUserId?: string | null;
  actorEmail?: string | null;
}): Promise<boolean> => {
  const existingRuntime = await supabaseAdmin
    .from("legal_policy_runtime")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (existingRuntime.error) {
    throw new Error(existingRuntime.error.message || `Failed to inspect legal policy ${slug}.`);
  }
  if (existingRuntime.data) return false;

  const latestVersionResult = await supabaseAdmin
    .from("legal_policy_versions")
    .select("id, version")
    .eq("slug", slug)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestVersionResult.error) {
    throw new Error(
      latestVersionResult.error.message || `Failed to inspect legal policy versions for ${slug}.`
    );
  }

  let activeVersion = latestVersionResult.data as LegalPolicyVersionRow | null;
  if (!activeVersion) {
    const insertVersion = await supabaseAdmin
      .from("legal_policy_versions")
      .insert({
        slug,
        version: 1,
        markdown: normalizeMarkdown(await readSeedMarkdown(slug)),
        note: "baseline_seed_v1",
        created_by_user_id: actorUserId,
        created_by_email: actorEmail,
      })
      .select("id, version")
      .single();
    if (insertVersion.error) {
      throw new Error(
        insertVersion.error.message || `Failed to seed legal policy version for ${slug}.`
      );
    }
    activeVersion = insertVersion.data as LegalPolicyVersionRow;
  }

  const insertRuntime = await supabaseAdmin.from("legal_policy_runtime").upsert(
    {
      slug,
      active_policy_version_id: activeVersion.id,
      last_known_safe_policy_version_id: activeVersion.id,
      updated_by_user_id: actorUserId,
      updated_by_email: actorEmail,
    },
    { onConflict: "slug" }
  );
  if (insertRuntime.error) {
    throw new Error(insertRuntime.error.message || `Failed to seed legal policy runtime ${slug}.`);
  }

  clearLegalPolicyControlPlaneCacheForTests();
  return true;
};

export const clearLegalPolicyControlPlaneCacheForTests = (): void => {
  publicPolicyCache = {};
};

/**
 * Resolve the active policy for public pages. Configured environments require the live control plane.
 */
export const resolveLegalPolicyForPublicPage = async ({
  slug,
  bypassCache = false,
  controlPlaneCacheTtlMs = process.env.LEGAL_POLICY_CONTROL_PLANE_CACHE_TTL_MS,
}: {
  slug: LegalPolicySlug;
  bypassCache?: boolean;
  controlPlaneCacheTtlMs?: string | null;
}): Promise<LegalPolicyDocument> => {
  if (!hasSupabaseAdminConfig()) {
    return buildSeedPolicyDocument(slug);
  }

  const nowMs = Date.now();
  const cached = publicPolicyCache[slug];
  if (!bypassCache && cached && cached.expiresAtMs > nowMs) {
    return cached.value;
  }

  try {
    let activePolicy = await fetchActiveLegalPolicy({ slug });
    if (!activePolicy) {
      await ensureLegalPolicyInitialized({ slug });
      activePolicy = await fetchActiveLegalPolicy({ slug });
    }
    if (!activePolicy) {
      throw new LegalPolicyUnavailableError(slug);
    }
    publicPolicyCache[slug] = {
      expiresAtMs: nowMs + resolveLegalPolicyCacheTtlMs(controlPlaneCacheTtlMs),
      value: activePolicy,
    };
    return activePolicy;
  } catch (error) {
    if (error instanceof LegalPolicyUnavailableError) throw error;
    throw new LegalPolicyUnavailableError(slug);
  }
};

const listLegalPolicyHistory = async ({
  slug,
  activeVersionId,
  supabaseAdmin,
}: {
  slug: LegalPolicySlug;
  activeVersionId: number | null;
  supabaseAdmin: SupabaseClient;
}): Promise<LegalPolicyVersionSummary[]> => {
  const { data, error } = await supabaseAdmin
    .from("legal_policy_versions")
    .select("id, version, note, created_at, created_by_email")
    .eq("slug", slug)
    .order("version", { ascending: false })
    .limit(12);
  if (error) {
    throw new Error(error.message || `Failed to load legal policy history for ${slug}.`);
  }
  return (data ?? []).map((row) => ({
    version: Number(row.version),
    versionId: Number(row.id),
    note: asNullableString(row.note),
    createdAt: asNullableString(row.created_at),
    createdByEmail: asNullableString(row.created_by_email),
    isActive: Number(row.id) === activeVersionId,
  }));
};

export const resolveLegalPolicyForAdmin = async ({
  slug,
  supabaseAdmin = hasSupabaseAdminConfig() ? getSupabaseAdmin() : undefined,
}: {
  slug: LegalPolicySlug;
  supabaseAdmin?: SupabaseClient;
}): Promise<LegalPolicyAdminDocument> => {
  if (!supabaseAdmin) {
    return {
      ...(await buildSeedPolicyDocument(slug)),
      degraded: false,
      history: [],
    };
  }

  try {
    let activePolicy = await fetchActiveLegalPolicy({ slug, supabaseAdmin });
    if (!activePolicy) {
      await ensureLegalPolicyInitialized({ slug, supabaseAdmin });
      activePolicy = await fetchActiveLegalPolicy({ slug, supabaseAdmin });
    }
    if (!activePolicy) {
      throw new LegalPolicyUnavailableError(slug);
    }
    return {
      ...activePolicy,
      degraded: false,
      history: await listLegalPolicyHistory({
        slug,
        activeVersionId: activePolicy.versionId,
        supabaseAdmin,
      }),
    };
  } catch {
    return {
      ...(await buildSeedPolicyDocument(slug)),
      degraded: true,
      history: [],
    };
  }
};

export const listLegalPoliciesForAdmin = async (): Promise<LegalPolicyAdminDocument[]> =>
  Promise.all(LEGAL_POLICY_SLUGS.map((slug) => resolveLegalPolicyForAdmin({ slug })));

export const publishLegalPolicy = async ({
  slug,
  markdown,
  expectedUpdatedAt,
  note,
  actorUserId,
  actorEmail,
  supabaseAdmin = getSupabaseAdmin(),
}: {
  slug: LegalPolicySlug;
  markdown: string;
  expectedUpdatedAt: string | null;
  note?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  supabaseAdmin?: SupabaseClient;
}): Promise<LegalPolicyAdminDocument> => {
  const normalizedMarkdown = normalizeMarkdown(markdown);

  const applyPublication = async () => {
    const { data, error } = await supabaseAdmin.rpc("publish_legal_policy", {
      p_slug: slug,
      p_markdown: normalizedMarkdown,
      p_expected_updated_at: expectedUpdatedAt,
      p_note: note ?? null,
      p_actor_user_id: actorUserId ?? null,
      p_actor_email: actorEmail ?? null,
      p_source: "admin_api",
    });
    if (error) {
      throw new Error(error.message || `Failed to publish legal policy ${slug}.`);
    }
    return normalizeRpcRow(data);
  };

  let result = await applyPublication();
  if (asNullableString(result?.status) === "not_initialized") {
    await ensureLegalPolicyInitialized({
      slug,
      supabaseAdmin,
      actorUserId: actorUserId ?? null,
      actorEmail: actorEmail ?? null,
    });
    result = await applyPublication();
  }
  const status = asNullableString(result?.status);
  if (status === "stale") {
    throw new LegalPolicyVersionMismatchError(slug);
  }
  if (status !== "activated") {
    throw new Error(asNullableString(result?.message) ?? `Legal policy ${slug} was not published.`);
  }

  clearLegalPolicyControlPlaneCacheForTests();
  return resolveLegalPolicyForAdmin({ slug, supabaseAdmin });
};
