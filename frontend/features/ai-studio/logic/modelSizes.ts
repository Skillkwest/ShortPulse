export type AspectSize = { width: number; height: number; imageSize?: string };

export const falImageSizeMap: Record<string, AspectSize & { imageSize: string }> = {
  "1:1": { width: 1024, height: 1024, imageSize: "square" },
  "4:3": { width: 1200, height: 900, imageSize: "landscape_4_3" },
  "3:4": { width: 900, height: 1200, imageSize: "portrait_4_3" },
  "16:9": { width: 1344, height: 756, imageSize: "landscape_16_9" },
  "9:16": { width: 756, height: 1344, imageSize: "portrait_16_9" },
};

export const resolveAspectSize = (
  aspect: string | undefined,
  sizeMap: Record<string, AspectSize>,
  fallbackAspect: string
): AspectSize | null => {
  if (aspect && sizeMap[aspect]) return sizeMap[aspect];
  if (sizeMap[fallbackAspect]) return sizeMap[fallbackAspect];
  const [first] = Object.values(sizeMap);
  return first ?? null;
};
