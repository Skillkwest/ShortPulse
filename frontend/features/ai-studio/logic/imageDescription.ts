/**
 * Shared helper for preparing image URLs before AI Studio submits them to server-side routes.
 */
import { prepareImageUrlForSubmission } from "../utils/imageUpload";

export const prepareImageUrl = async (imageUrl: string): Promise<string | null> => {
  if (!imageUrl?.trim()) return null;
  try {
    const prepared = await prepareImageUrlForSubmission(imageUrl);
    return prepared?.startsWith("https://") ? prepared : null;
  } catch {
    return null;
  }
};
