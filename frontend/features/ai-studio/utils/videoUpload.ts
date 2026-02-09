/**
 * Video upload utility for Motion Control
 * Uploads blob URLs to Supabase storage and returns public URLs
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";

export type VideoUploadResult = {
  url: string;
  path: string;
  size: number;
};

export type VideoUploadError = {
  message: string;
  code?: string;
};

/**
 * Uploads a video blob to storage and returns the public URL
 * @param videoBlobUrl - The blob URL from createObjectURL or file input
 * @returns Promise with the public URL
 */
export const uploadVideoToStorage = async (
  videoBlobUrl: string,
): Promise<string> => {
  try {
    // Convert blob URL to actual File object
    const response = await fetch(videoBlobUrl);
    const blob = await response.blob();

    // Generate a unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = blob.type.split('/')[1] || 'mp4';
    const filename = `motion-reference-${timestamp}-${randomString}.${extension}`;

    // Create FormData
    const formData = new FormData();
    formData.append('file', blob, filename);

    // Upload to your API endpoint
    const uploadResponse = await fetchWithAuth('/api/upload-video', {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({}));
      throw new Error(errorData.error || 'Video upload failed');
    }

    const result: VideoUploadResult = await uploadResponse.json();
    return result.url;
  } catch (error) {
    console.error('Video upload error:', error);
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to upload video. Please try again.'
    );
  }
};

/**
 * Checks if a URL is a blob URL that needs uploading
 */
export const needsVideoUpload = (url: string | null): boolean => {
  return Boolean(url && url.startsWith('blob:'));
};

/**
 * Prepares a video URL for submission
 * - If it's a blob URL, uploads it and returns the public URL
 * - Otherwise returns the URL as-is
 */
export const prepareVideoUrl = async (url: string | null): Promise<string | null> => {
  if (!url) return null;

  if (needsVideoUpload(url)) {
    return await uploadVideoToStorage(url);
  }

  return url;
};
