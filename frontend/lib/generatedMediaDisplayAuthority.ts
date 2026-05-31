import { asCanonicalStoragePath } from "./adaptive-media";

export type GeneratedMediaDisplayAuthorityInput = {
  previewText?: string | null;
  savedMediaIds?: Array<string | null | undefined> | null;
  previewPosterStoragePath?: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  companionArtStoragePath?: string | null;
};

const hasTrimmedValue = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

const hasCanonicalPath = (value: string | null | undefined): boolean =>
  Boolean(asCanonicalStoragePath(value));

export const hasDurableGeneratedMediaDisplayAuthority = ({
  previewText,
  savedMediaIds,
  previewPosterStoragePath,
  previewStoragePath,
  fullStoragePath,
  companionArtStoragePath,
}: GeneratedMediaDisplayAuthorityInput): boolean => {
  if (hasTrimmedValue(previewText)) return true;
  if (savedMediaIds?.some((value) => hasTrimmedValue(value))) return true;
  return (
    hasCanonicalPath(previewPosterStoragePath) ||
    hasCanonicalPath(previewStoragePath) ||
    hasCanonicalPath(fullStoragePath) ||
    hasCanonicalPath(companionArtStoragePath)
  );
};
