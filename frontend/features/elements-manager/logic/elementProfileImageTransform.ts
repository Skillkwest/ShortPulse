/**
 * Shared element profile image transform helpers.
 * Converts persisted crop settings into render-time CSS for all small avatar surfaces.
 */
import type { CSSProperties } from "react";
import type { ElementProfileImageTransform } from "../types";

export const ELEMENT_PROFILE_IMAGE_PREVIEW_SIZE = 172;

/**
 * Builds CSS for rendering a persisted element profile crop at a different avatar size.
 *
 * @param transform Persisted profile crop settings.
 * @param renderSize Avatar size being rendered.
 * @param sourcePreviewSize Size the persisted crop values were tuned against.
 * @returns CSS transform styles, or `undefined` when no transform is available.
 */
export function buildElementProfileImageTransformStyle(
  transform: ElementProfileImageTransform | null | undefined,
  renderSize: number,
  sourcePreviewSize: number = ELEMENT_PROFILE_IMAGE_PREVIEW_SIZE
): CSSProperties | undefined {
  if (!transform) return undefined;

  const offsetScale = renderSize / sourcePreviewSize;
  const offsetX = Math.round(transform.offsetX * offsetScale * 100) / 100;
  const offsetY = Math.round(transform.offsetY * offsetScale * 100) / 100;

  return {
    transform: `translate(${offsetX}px, ${offsetY}px) scale(${transform.zoom})`,
    transformOrigin: "center center",
  };
}

/**
 * Builds CSS background-image styling for avatar chips that need a square crop without
 * layering an additional object-fit crop on top of the saved framing.
 *
 * @param imageUrl Source image URL.
 * @param transform Persisted profile crop settings.
 * @param renderSize Avatar size being rendered.
 * @param sourcePreviewSize Size the persisted crop values were tuned against.
 * @returns CSS properties for a background-image tile.
 */
export function buildElementProfileImageBackgroundStyle(
  imageUrl: string,
  transform: ElementProfileImageTransform | null | undefined,
  renderSize: number,
  sourcePreviewSize: number = ELEMENT_PROFILE_IMAGE_PREVIEW_SIZE
): CSSProperties {
  const normalizedTransform = transform ?? { zoom: 1, offsetX: 0, offsetY: 0 };
  const offsetScale = renderSize / sourcePreviewSize;
  const offsetX = Math.round(normalizedTransform.offsetX * offsetScale * 100) / 100;
  const offsetY = Math.round(normalizedTransform.offsetY * offsetScale * 100) / 100;

  return {
    backgroundImage: `url("${imageUrl}")`,
    backgroundRepeat: "no-repeat",
    backgroundSize: transform ? `${normalizedTransform.zoom * 100}%` : "cover",
    backgroundPosition: transform
      ? `calc(50% + ${offsetX}px) calc(50% + ${offsetY}px)`
      : "center center",
  };
}
