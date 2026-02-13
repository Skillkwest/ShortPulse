/**
 * Deterministic character reference validation.
 * Produces pass/warn/fail states from local file properties without ML classifiers.
 */
import { CHARACTER_MANAGER_SLOT_LABEL_BY_KEY } from "../constants";
import type {
  CharacterReferenceSlotKey,
  CharacterSlotFileMap,
  CharacterSlotValidationNotes,
  CharacterSlotValidationStatus,
} from "../types";

const VALIDATOR_VERSION = 1;
const HARD_MIN_DIMENSION = 512;
const WARN_MIN_DIMENSION = 1024;
const WARN_MIN_PIXEL_COUNT = 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
]);

type AspectBand = {
  min: number;
  max: number;
};

type CharacterValidationInput = {
  slotKey: CharacterReferenceSlotKey;
  file: File;
  existingSlots: CharacterSlotFileMap;
};

export type CharacterReferenceValidationResult = {
  status: CharacterSlotValidationStatus;
  notes: CharacterSlotValidationNotes;
};

const DEFAULT_ASPECT_BAND: AspectBand = {
  min: 0.45,
  max: 0.9,
};

const ASPECT_BAND_BY_SLOT: Record<CharacterReferenceSlotKey, AspectBand> = {
  front_full: DEFAULT_ASPECT_BAND,
  side_profile: DEFAULT_ASPECT_BAND,
  back_full: DEFAULT_ASPECT_BAND,
  top_down: DEFAULT_ASPECT_BAND,
  front_left_34: DEFAULT_ASPECT_BAND,
  front_right_34: DEFAULT_ASPECT_BAND,
  back_left_34: DEFAULT_ASPECT_BAND,
  back_right_34: DEFAULT_ASPECT_BAND,
  portrait_close: { min: 0.7, max: 1.4 },
  fullbody_wide: { min: 0.4, max: 1.6 },
};

/**
 * Returns a default, shape-stable validation notes object.
 */
export const createDefaultCharacterValidationNotes = (): CharacterSlotValidationNotes => ({
  validatorVersion: VALIDATOR_VERSION,
  mimeType: null,
  width: null,
  height: null,
  aspectRatio: null,
  sha256: null,
  hardErrors: [],
  warnings: [],
  evaluatedAt: null,
});

const readImageDimensions = async (file: File): Promise<{ width: number; height: number }> => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      };
      image.onerror = () => reject(new Error("Unable to read image dimensions."));
      image.src = objectUrl;
    });
    return dimensions;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const hashFileSha256 = async (file: File): Promise<string | null> => {
  if (!("crypto" in window) || !window.crypto?.subtle) {
    return null;
  }

  const buffer = await file.arrayBuffer();
  const digest = await window.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const resolveValidationStatus = ({
  hardErrors,
  warnings,
}: {
  hardErrors: string[];
  warnings: string[];
}): CharacterSlotValidationStatus => {
  if (hardErrors.length) return "fail";
  if (warnings.length) return "warn";
  return "pass";
};

/**
 * Validate a reference image deterministically for slot guidance and activation safety.
 */
export const validateCharacterReferenceFile = async ({
  slotKey,
  file,
  existingSlots,
}: CharacterValidationInput): Promise<CharacterReferenceValidationResult> => {
  const notes = createDefaultCharacterValidationNotes();
  notes.mimeType = file.type || null;
  notes.evaluatedAt = new Date().toISOString();
  const hardErrors: string[] = [];
  const warnings: string[] = [];

  const normalizedMimeType = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
    hardErrors.push("Unsupported image format. Use JPEG, PNG, WEBP, HEIC, HEIF, or AVIF.");
  }

  try {
    const dimensions = await readImageDimensions(file);
    notes.width = dimensions.width;
    notes.height = dimensions.height;
    if (dimensions.width <= 0 || dimensions.height <= 0) {
      hardErrors.push("Image dimensions are invalid. Choose a different file.");
    } else {
      const aspectRatio = dimensions.width / dimensions.height;
      notes.aspectRatio = Number(aspectRatio.toFixed(4));
      if (Math.min(dimensions.width, dimensions.height) < HARD_MIN_DIMENSION) {
        hardErrors.push(
          `Image is too small. Minimum side must be at least ${HARD_MIN_DIMENSION}px.`
        );
      } else if (Math.min(dimensions.width, dimensions.height) < WARN_MIN_DIMENSION) {
        warnings.push(
          `Higher resolution recommended. Target at least ${WARN_MIN_DIMENSION}px on the shortest side.`
        );
      }

      const pixelCount = dimensions.width * dimensions.height;
      if (pixelCount < WARN_MIN_PIXEL_COUNT) {
        warnings.push("Image may be too low detail for reliable character consistency.");
      }

      const aspectBand = ASPECT_BAND_BY_SLOT[slotKey];
      if (aspectRatio < aspectBand.min || aspectRatio > aspectBand.max) {
        warnings.push(
          `Framing looks unusual for ${CHARACTER_MANAGER_SLOT_LABEL_BY_KEY[slotKey]}. Consider re-framing this angle.`
        );
      }
    }
  } catch {
    hardErrors.push("Image could not be decoded. Re-export or choose another file.");
  }

  try {
    const sha256 = await hashFileSha256(file);
    notes.sha256 = sha256;
    if (!sha256) {
      warnings.push("Duplicate-angle detection unavailable in this browser session.");
    } else {
      const duplicateSlot = Object.entries(existingSlots).find(([existingSlotKey, slotFile]) => {
        if (existingSlotKey === slotKey) return false;
        return slotFile?.validationNotes.sha256 === sha256;
      });
      if (duplicateSlot) {
        const duplicateLabel =
          CHARACTER_MANAGER_SLOT_LABEL_BY_KEY[duplicateSlot[0] as CharacterReferenceSlotKey];
        hardErrors.push(`Image duplicates ${duplicateLabel}. Each required slot must be unique.`);
      }
    }
  } catch {
    warnings.push("Duplicate-angle detection failed for this file.");
  }

  notes.hardErrors = hardErrors;
  notes.warnings = warnings;

  return {
    status: resolveValidationStatus({ hardErrors, warnings }),
    notes,
  };
};
