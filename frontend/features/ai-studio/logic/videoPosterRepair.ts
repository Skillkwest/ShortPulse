/**
 * Client-side repair for restored video outputs that know durable media identity
 * but do not yet carry a renderable poster URL.
 */
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import { getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import { isVideoUrl } from "./stateParsers";
import type { StudioOutput } from "../types";

type MediaFilePosterRow = {
  id?: unknown;
  preview_storage_path?: unknown;
  storage_path?: unknown;
  file_type?: unknown;
  thumb_variant_path?: unknown;
  poster_variant_path?: unknown;
};

export type VideoPosterRepair = {
  outputId: string;
  previewPosterUrl: string;
  previewPosterStoragePath: string;
  previewStoragePath: string;
  fullStoragePath: string | null;
  previewUrl: string | null;
  resultUrls: string[] | null;
};

const normalizeText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeIdList = (values: readonly string[] | null | undefined): string[] =>
  Array.from(
    new Set(
      (values ?? [])
        .map((value) => normalizeText(value))
        .filter((value): value is string => Boolean(value))
    )
  );

const maybeString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length ? value.trim() : null;

const resolveKnownPosterStoragePath = (output: StudioOutput): string | null => {
  const posterStoragePath = asCanonicalStoragePath(output.previewPosterStoragePath);
  if (posterStoragePath) return posterStoragePath;

  const previewStoragePath = asCanonicalStoragePath(output.previewStoragePath);
  if (!previewStoragePath) return null;
  const fullStoragePath = asCanonicalStoragePath(output.fullStoragePath);
  if (previewStoragePath === fullStoragePath) return null;
  if (isVideoUrl(previewStoragePath)) return null;
  return previewStoragePath;
};

const resolveRowPosterStoragePath = (row: MediaFilePosterRow | null | undefined): string | null =>
  asCanonicalStoragePath(maybeString(row?.poster_variant_path)) ??
  asCanonicalStoragePath(maybeString(row?.thumb_variant_path));

const resolveRowFullStoragePath = (row: MediaFilePosterRow | null | undefined): string | null =>
  asCanonicalStoragePath(maybeString(row?.storage_path)) ??
  asCanonicalStoragePath(maybeString(row?.preview_storage_path));

const rowMatchesStoragePath = (row: MediaFilePosterRow, storagePath: string): boolean =>
  asCanonicalStoragePath(maybeString(row.storage_path)) === storagePath ||
  asCanonicalStoragePath(maybeString(row.preview_storage_path)) === storagePath;

const shouldRepairOutput = (output: StudioOutput): boolean => {
  if (output.mode !== "video") return false;
  if (normalizeText(output.previewPosterUrl)) return false;
  if (resolveKnownPosterStoragePath(output)) return true;
  if (normalizeIdList(output.savedMediaIds).length > 0) return true;
  return Boolean(
    asCanonicalStoragePath(output.fullStoragePath) ??
    asCanonicalStoragePath(output.previewStoragePath)
  );
};

const selectMediaRows = async (
  column: "id" | "storage_path" | "preview_storage_path",
  values: string[]
): Promise<MediaFilePosterRow[]> => {
  if (!values.length) return [];
  const supabase = ensureSupabaseQueryClient();
  const { data, error } = await supabase
    .from("media_files")
    .select(
      "id, preview_storage_path, storage_path, file_type, thumb_variant_path, poster_variant_path"
    )
    .in(column, values)
    .limit(values.length);
  if (error || !Array.isArray(data)) return [];
  return data as MediaFilePosterRow[];
};

const dedupeRows = (rows: MediaFilePosterRow[]): MediaFilePosterRow[] => {
  const byKey = new Map<string, MediaFilePosterRow>();
  rows.forEach((row, index) => {
    const key =
      maybeString(row.id) ??
      asCanonicalStoragePath(maybeString(row.storage_path)) ??
      asCanonicalStoragePath(maybeString(row.preview_storage_path)) ??
      `row-${index}`;
    if (!byKey.has(key)) byKey.set(key, row);
  });
  return Array.from(byKey.values());
};

const resolveBestRowForOutput = (
  output: StudioOutput,
  rows: MediaFilePosterRow[]
): MediaFilePosterRow | null => {
  const savedMediaIds = normalizeIdList(output.savedMediaIds);
  for (const mediaId of savedMediaIds) {
    const row = rows.find((candidate) => maybeString(candidate.id) === mediaId);
    if (row && resolveRowPosterStoragePath(row)) return row;
  }

  const storagePaths = [
    asCanonicalStoragePath(output.fullStoragePath),
    asCanonicalStoragePath(output.previewStoragePath),
  ].filter((value): value is string => Boolean(value));
  for (const storagePath of storagePaths) {
    const row = rows.find((candidate) => rowMatchesStoragePath(candidate, storagePath));
    if (row && resolveRowPosterStoragePath(row)) return row;
  }

  return null;
};

/**
 * Resolves missing video poster URLs for restored/session outputs using durable media identity.
 */
export const resolveVideoPosterRepairsForOutputs = async (
  outputs: StudioOutput[]
): Promise<Map<string, VideoPosterRepair>> => {
  const candidates = outputs.filter(shouldRepairOutput);
  if (!candidates.length) return new Map();

  const mediaIds = Array.from(
    new Set(candidates.flatMap((output) => normalizeIdList(output.savedMediaIds)))
  );
  const storagePaths = Array.from(
    new Set(
      candidates
        .flatMap((output) => [
          asCanonicalStoragePath(output.fullStoragePath),
          asCanonicalStoragePath(output.previewStoragePath),
        ])
        .filter((value): value is string => Boolean(value))
    )
  );

  let mediaRows: MediaFilePosterRow[] = [];
  try {
    const [byId, byStoragePath, byPreviewStoragePath] = await Promise.all([
      selectMediaRows("id", mediaIds),
      selectMediaRows("storage_path", storagePaths),
      selectMediaRows("preview_storage_path", storagePaths),
    ]);
    mediaRows = dedupeRows([...byId, ...byStoragePath, ...byPreviewStoragePath]);
  } catch {
    mediaRows = [];
  }

  const posterPathByOutputId = new Map<string, string>();
  const fullPathByOutputId = new Map<string, string | null>();
  const pathsToSign = new Set<string>();

  for (const output of candidates) {
    const mediaRow = resolveBestRowForOutput(output, mediaRows);
    const posterStoragePath =
      resolveKnownPosterStoragePath(output) ?? resolveRowPosterStoragePath(mediaRow);
    if (!posterStoragePath) continue;

    const fullStoragePath =
      asCanonicalStoragePath(output.fullStoragePath) ??
      resolveRowFullStoragePath(mediaRow) ??
      asCanonicalStoragePath(output.previewStoragePath);

    posterPathByOutputId.set(output.id, posterStoragePath);
    fullPathByOutputId.set(output.id, fullStoragePath ?? null);
    pathsToSign.add(posterStoragePath);
    if (!normalizeText(output.previewUrl) && fullStoragePath) {
      pathsToSign.add(fullStoragePath);
    }
  }

  if (!pathsToSign.size) return new Map();

  const signedByPath = await getSignedMediaUrlsBatch({
    bucket: "media_library",
    storagePaths: Array.from(pathsToSign),
    surface: "reference-grid",
    queryMode: "default",
  }).catch(() => null);
  if (!signedByPath) return new Map();

  const repairs = new Map<string, VideoPosterRepair>();
  for (const output of candidates) {
    const posterStoragePath = posterPathByOutputId.get(output.id);
    if (!posterStoragePath) continue;
    const previewPosterUrl = signedByPath.get(posterStoragePath) ?? null;
    if (!previewPosterUrl) continue;

    const fullStoragePath = fullPathByOutputId.get(output.id) ?? null;
    const signedFullUrl = fullStoragePath ? (signedByPath.get(fullStoragePath) ?? null) : null;
    repairs.set(output.id, {
      outputId: output.id,
      previewPosterUrl,
      previewPosterStoragePath: posterStoragePath,
      previewStoragePath: posterStoragePath,
      fullStoragePath,
      previewUrl: normalizeText(output.previewUrl) ?? signedFullUrl,
      resultUrls:
        output.resultUrls && output.resultUrls.length > 0
          ? output.resultUrls
          : signedFullUrl
            ? [signedFullUrl]
            : null,
    });
  }

  return repairs;
};
