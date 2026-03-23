/**
 * Style-extraction prompt policy helpers.
 * Enforces a deterministic leading style-class descriptor for extracted style prompts.
 */

type StyleClassLabel =
  | "Candid Cell Phone Snapshot"
  | "Anime Style"
  | "Cartoon Style"
  | "Hyper-realistic"
  | "Photorealistic"
  | "Vintage"
  | "Digital Illustration"
  | "3D Render"
  | "Concept Art"
  | "Hand-Drawn"
  | "Painting"
  | "Photographic";

type StyleClassRule = {
  label: StyleClassLabel;
  pattern: RegExp;
};

const STYLE_CLASS_RULES: readonly StyleClassRule[] = [
  {
    label: "Candid Cell Phone Snapshot",
    pattern:
      /\b(?:candid|snapshot|phone|smartphone|mobile|iphone|android|selfie|point[- ]and[- ]shoot)\b/i,
  },
  {
    label: "Anime Style",
    pattern: /\b(?:anime|manga|cel[- ]?shad(?:e|ing)|otaku)\b/i,
  },
  {
    label: "Cartoon Style",
    pattern: /\b(?:cartoon|toon|comic(?:[- ]book)?|illustrative cartoon)\b/i,
  },
  {
    label: "Hyper-realistic",
    pattern: /\b(?:hyper[- ]?real(?:istic)?|ultra[- ]?real(?:istic)?)\b/i,
  },
  {
    label: "Photorealistic",
    pattern: /\b(?:photo[- ]?real(?:istic)?)\b/i,
  },
  {
    label: "Vintage",
    pattern: /\b(?:vintage|retro|analog|film stock|old[- ]school)\b/i,
  },
  {
    label: "Digital Illustration",
    pattern: /\b(?:digital illustration|digital art|illustration)\b/i,
  },
  {
    label: "3D Render",
    pattern: /\b(?:3d|cgi|cg render|rendered|octane|unreal|blender)\b/i,
  },
  {
    label: "Concept Art",
    pattern: /\b(?:concept art|key art|production art)\b/i,
  },
  {
    label: "Hand-Drawn",
    pattern: /\b(?:hand[- ]?drawn|sketch|line art|ink drawing|pencil drawing)\b/i,
  },
  {
    label: "Painting",
    pattern: /\b(?:painting|painterly|oil paint|watercolor|acrylic)\b/i,
  },
  {
    label: "Photographic",
    pattern: /\b(?:photographic|photography|camera|lens|bokeh|dslr)\b/i,
  },
];

const normalizeDescriptor = (value: string): string => {
  return value
    .replace(/\s{2,}/g, " ")
    .replace(/(^|,\s*)(?:[-*]|\d+\.)\s+/g, "$1")
    .replace(/[.;]+$/g, "")
    .trim();
};

const splitDescriptors = (value: string): string[] => {
  return value
    .split(",")
    .map((part) => normalizeDescriptor(part))
    .filter((part) => part.length > 0);
};

const normalizeStyleClassKey = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/\bstyle\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
};

/**
 * Returns the dominant style class label inferred from extracted style descriptors.
 */
export const resolveHardStyleClass = (stylePrompt: string): StyleClassLabel => {
  const normalizedPrompt = stylePrompt.trim();
  for (const rule of STYLE_CLASS_RULES) {
    if (rule.pattern.test(normalizedPrompt)) {
      return rule.label;
    }
  }
  return "Photographic";
};

/**
 * Forces style prompts to begin with a deterministic hard style-class descriptor.
 */
export const enforceLeadingHardStyleClass = (stylePrompt: string): string => {
  const styleClass = resolveHardStyleClass(stylePrompt);
  const selectedStyleClassKey = normalizeStyleClassKey(styleClass);
  const descriptors = splitDescriptors(stylePrompt);
  const uniqueDescriptors: string[] = [];
  const seenDescriptorKeys = new Set<string>();

  for (const descriptor of descriptors) {
    const descriptorKey = normalizeStyleClassKey(descriptor);
    if (!descriptorKey || descriptorKey === selectedStyleClassKey) {
      continue;
    }
    if (seenDescriptorKeys.has(descriptorKey)) {
      continue;
    }
    seenDescriptorKeys.add(descriptorKey);
    uniqueDescriptors.push(descriptor);
  }

  return [styleClass, ...uniqueDescriptors].join(", ");
};
