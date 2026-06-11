/**
 * YouTube tutorial embed helpers.
 * Converts admin-managed YouTube watch/share URLs into safe iframe embed URLs.
 */

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const YOUTUBE_SHORT_HOSTS = new Set(["youtu.be", "www.youtu.be"]);
const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{6,}$/;

const cleanVideoId = (value: string | null): string | null => {
  const candidate = value?.trim() ?? "";
  if (!candidate || !YOUTUBE_ID_PATTERN.test(candidate)) return null;
  return candidate;
};

/**
 * Extracts a YouTube video id from supported YouTube URL formats.
 */
export const resolveYoutubeVideoId = (youtubeUrl: string): string | null => {
  try {
    const url = new URL(youtubeUrl);
    const hostname = url.hostname.toLowerCase();

    if (YOUTUBE_SHORT_HOSTS.has(hostname)) {
      return cleanVideoId(url.pathname.split("/").filter(Boolean)[0] ?? null);
    }

    if (!YOUTUBE_HOSTS.has(hostname)) {
      return null;
    }

    if (url.pathname === "/watch") {
      return cleanVideoId(url.searchParams.get("v"));
    }

    const pathParts = url.pathname.split("/").filter(Boolean);
    if (pathParts[0] === "embed" || pathParts[0] === "shorts" || pathParts[0] === "live") {
      return cleanVideoId(pathParts[1] ?? null);
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Builds the privacy-enhanced YouTube iframe source for a validated tutorial URL.
 */
export const resolveYoutubeEmbedUrl = (youtubeUrl: string): string | null => {
  const videoId = resolveYoutubeVideoId(youtubeUrl);
  if (!videoId) return null;
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
};
