/**
 * Shared constants and geometry/export helpers for the master-stage bakeoff lab.
 * Keeps candidate surfaces aligned on the same viewport, artboard, seed image, and export contract.
 */
import {
  defaultLayerTransform,
  resolveContainedLayerRect,
  resolveTransformGeometry,
  type LayerTransform,
} from "../expertEditLayerTransformUtils";
import {
  resolveSurfacePointFromClientPoint,
  type StageViewportTransform,
} from "../stageSceneGeometry";

export const STAGE_BAKEOFF_VIEWPORT_WIDTH = 920;
export const STAGE_BAKEOFF_VIEWPORT_HEIGHT = 560;
export const STAGE_BAKEOFF_ARTBOARD_WIDTH = 1600;
export const STAGE_BAKEOFF_ARTBOARD_HEIGHT = 900;
export const STAGE_BAKEOFF_ARTBOARD_PADDING = 40;
export const STAGE_BAKEOFF_ZOOM_MIN = 0.35;
export const STAGE_BAKEOFF_ZOOM_MAX = 2.5;

export const STAGE_BAKEOFF_CHECKLIST = [
  "Pan and zoom around a fixed workspace.",
  "Keep one bounded aspect-ratio artboard authoritative.",
  "Move, resize, and rotate a single image layer.",
  "Export a flattened artboard image.",
] as const;

const STAGE_BAKEOFF_SAMPLE_IMAGE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1400" viewBox="0 0 1000 1400" fill="none">
  <defs>
    <linearGradient id="bg" x1="40" y1="20" x2="920" y2="1320" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F5C29C"/>
      <stop offset="0.48" stop-color="#EE7C58"/>
      <stop offset="1" stop-color="#342B5A"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="1400" fill="url(#bg)"/>
  <rect x="84" y="84" width="832" height="1232" rx="36" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.5)" stroke-width="8"/>
  <circle cx="500" cy="472" r="156" fill="rgba(255,250,240,0.72)"/>
  <path d="M312 1100C312 975.184 413.184 874 538 874H542C666.816 874 768 975.184 768 1100V1228H312V1100Z" fill="rgba(25,22,38,0.76)"/>
  <path d="M364 1098C364 1002.484 441.484 925 537 925H543C638.516 925 716 1002.484 716 1098V1228H364V1098Z" fill="rgba(255,255,255,0.3)"/>
  <path d="M276 278L376 192L498 320L668 168L804 312" stroke="rgba(255,255,255,0.68)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M226 1294H774" stroke="rgba(255,255,255,0.76)" stroke-width="14" stroke-linecap="round"/>
  <text x="500" y="170" text-anchor="middle" fill="#FFF8F3" font-size="72" font-family="Arial, sans-serif" font-weight="700">Bakeoff Portrait</text>
  <text x="500" y="1310" text-anchor="middle" fill="rgba(255,255,255,0.82)" font-size="36" font-family="Arial, sans-serif">Move · Resize · Rotate · Export</text>
</svg>
`.trim();

export const STAGE_BAKEOFF_SAMPLE_IMAGE = {
  src: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(STAGE_BAKEOFF_SAMPLE_IMAGE_SVG)}`,
  width: 1000,
  height: 1400,
  alt: "Bakeoff portrait",
};

export type StageBakeoffArtboardRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type StageBakeoffLayerGeometry = {
  baseRect: ReturnType<typeof resolveContainedLayerRect>;
  transformGeometry: ReturnType<typeof resolveTransformGeometry>;
};

/**
 * Returns the initial camera state for all candidates.
 */
export const createStageBakeoffCamera = (): StageViewportTransform => ({
  scale: 1,
  offsetX: 0,
  offsetY: 0,
});

/**
 * Returns the initial layer transform for all candidates.
 */
export const createStageBakeoffLayerTransform = (): LayerTransform => defaultLayerTransform();

/**
 * Clamps candidate zoom levels to the shared bakeoff range.
 */
export const clampStageBakeoffZoom = (value: number) =>
  Math.min(STAGE_BAKEOFF_ZOOM_MAX, Math.max(STAGE_BAKEOFF_ZOOM_MIN, value));

/**
 * Fits the canonical artboard inside the fixed bakeoff viewport.
 */
export const resolveStageBakeoffArtboardRect = (): StageBakeoffArtboardRect => {
  const availableWidth = STAGE_BAKEOFF_VIEWPORT_WIDTH - STAGE_BAKEOFF_ARTBOARD_PADDING * 2;
  const availableHeight = STAGE_BAKEOFF_VIEWPORT_HEIGHT - STAGE_BAKEOFF_ARTBOARD_PADDING * 2;
  const aspectRatio = STAGE_BAKEOFF_ARTBOARD_WIDTH / STAGE_BAKEOFF_ARTBOARD_HEIGHT;

  let width = availableWidth;
  let height = width / aspectRatio;
  if (height > availableHeight) {
    height = availableHeight;
    width = height * aspectRatio;
  }

  return {
    left: (STAGE_BAKEOFF_VIEWPORT_WIDTH - width) / 2,
    top: (STAGE_BAKEOFF_VIEWPORT_HEIGHT - height) / 2,
    width,
    height,
  };
};

/**
 * Resolves the contained seed-image rect within the artboard at scale=1.
 */
export const resolveStageBakeoffLayerBaseRect = () =>
  resolveContainedLayerRect({
    imageAspectRatio: STAGE_BAKEOFF_SAMPLE_IMAGE.width / STAGE_BAKEOFF_SAMPLE_IMAGE.height,
    viewportWidth: resolveStageBakeoffArtboardRect().width,
    viewportHeight: resolveStageBakeoffArtboardRect().height,
  });

/**
 * Resolves the seed-layer geometry for overlay handles and center positioning.
 */
export const resolveStageBakeoffLayerGeometry = (
  transform: LayerTransform
): StageBakeoffLayerGeometry => {
  const artboardRect = resolveStageBakeoffArtboardRect();
  const baseRect = resolveContainedLayerRect({
    imageAspectRatio: STAGE_BAKEOFF_SAMPLE_IMAGE.width / STAGE_BAKEOFF_SAMPLE_IMAGE.height,
    viewportWidth: artboardRect.width,
    viewportHeight: artboardRect.height,
  });

  return {
    baseRect,
    transformGeometry: resolveTransformGeometry({
      transform,
      dropzoneWidth: artboardRect.width,
      dropzoneHeight: artboardRect.height,
      baseWidth: baseRect.width,
      baseHeight: baseRect.height,
    }),
  };
};

/**
 * Converts a client-space pointer into artboard-local coordinates through the shared camera.
 */
export const resolveStageBakeoffArtboardPointFromClient = ({
  clientX,
  clientY,
  viewportRect,
  camera,
}: {
  clientX: number;
  clientY: number;
  viewportRect: DOMRect;
  camera: StageViewportTransform;
}) => {
  const artboardRect = resolveStageBakeoffArtboardRect();
  const workspacePoint = resolveSurfacePointFromClientPoint({
    clientX,
    clientY,
    rect: viewportRect,
    viewportTransform: camera,
    clampToBounds: false,
  });

  if (!workspacePoint) return null;
  return {
    x: workspacePoint.x - artboardRect.left,
    y: workspacePoint.y - artboardRect.top,
  };
};

/**
 * Applies zoom while preserving the workspace point under the cursor.
 */
export const resolveStageBakeoffZoomAboutClientPoint = ({
  clientX,
  clientY,
  viewportRect,
  camera,
  nextScale,
}: {
  clientX: number;
  clientY: number;
  viewportRect: DOMRect;
  camera: StageViewportTransform;
  nextScale: number;
}): StageViewportTransform => {
  const clampedScale = clampStageBakeoffZoom(nextScale);
  const workspacePoint = resolveSurfacePointFromClientPoint({
    clientX,
    clientY,
    rect: viewportRect,
    viewportTransform: camera,
    clampToBounds: false,
  });

  if (!workspacePoint) {
    return {
      ...camera,
      scale: clampedScale,
    };
  }

  const sampleX = clientX - viewportRect.left;
  const sampleY = clientY - viewportRect.top;
  const centerX = viewportRect.width / 2;
  const centerY = viewportRect.height / 2;

  return {
    scale: clampedScale,
    offsetX: sampleX - centerX - (workspacePoint.x - centerX) * clampedScale,
    offsetY: sampleY - centerY - (workspacePoint.y - centerY) * clampedScale,
  };
};

/**
 * Loads the shared seed image for DOM/Konva export and preview rendering.
 */
export const loadStageBakeoffSampleImage = (): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load the stage bakeoff seed image."));
    image.src = STAGE_BAKEOFF_SAMPLE_IMAGE.src;
  });

/**
 * Exports the canonical artboard as a flattened PNG using the shared seed image and layer transform.
 */
export const exportStageBakeoffScene = async (transform: LayerTransform): Promise<string> => {
  const image = await loadStageBakeoffSampleImage();
  const canvas = document.createElement("canvas");
  canvas.width = STAGE_BAKEOFF_ARTBOARD_WIDTH;
  canvas.height = STAGE_BAKEOFF_ARTBOARD_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create a 2D context for the stage bakeoff export.");
  }

  const baseRect = resolveContainedLayerRect({
    imageAspectRatio: STAGE_BAKEOFF_SAMPLE_IMAGE.width / STAGE_BAKEOFF_SAMPLE_IMAGE.height,
    viewportWidth: STAGE_BAKEOFF_ARTBOARD_WIDTH,
    viewportHeight: STAGE_BAKEOFF_ARTBOARD_HEIGHT,
  });

  context.fillStyle = "#f7f5f1";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(15, 23, 42, 0.12)";
  context.lineWidth = 4;
  context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

  context.save();
  context.translate(
    canvas.width / 2 + transform.translateXRatio * canvas.width,
    canvas.height / 2 + transform.translateYRatio * canvas.height
  );
  context.rotate((transform.rotationDeg * Math.PI) / 180);
  context.scale(transform.scale, transform.scale);
  context.drawImage(
    image,
    -baseRect.width / 2,
    -baseRect.height / 2,
    baseRect.width,
    baseRect.height
  );
  context.restore();

  return canvas.toDataURL("image/png");
};
