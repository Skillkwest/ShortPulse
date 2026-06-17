export const buildHiddenMediaArtifactStoragePathLikePatterns = (userId: string): string[] => [
  `${userId}/generations/audio/%/companion-art/%`,
];

export const isHiddenMediaArtifactStoragePath = (
  storagePath: string | null | undefined,
  userId?: string | null
): boolean => {
  if (typeof storagePath !== "string") return false;
  const normalized = storagePath.trim();
  if (!normalized) return false;
  if (userId) {
    return (
      normalized.startsWith(`${userId}/generations/audio/`) &&
      normalized.includes("/companion-art/")
    );
  }
  return /^(?:[^/]+)\/generations\/audio\/[^/]+\/companion-art\//.test(normalized);
};
