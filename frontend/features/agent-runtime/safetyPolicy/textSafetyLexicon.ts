/**
 * Shared regex lexicon for text safety classification and deterministic rewrites.
 */
import type { SafetyCategoryId } from "./types";

export const FAMILY_EXPLICIT_PATTERNS: Array<{ category: SafetyCategoryId; patterns: RegExp[] }> = [
  {
    category: "sexual_explicit",
    patterns: [
      /\b(?:porn|pornographic|hardcore)\b/i,
      /\b(?:sexual\s+(?:intercourse|act|acts|activity|activities))\b/i,
      /\b(?:graphic\s+sexual|explicit\s+sexual)\b/i,
      /\b(?:genitals?|penis|vagina)\b/i,
      /\b(?:ejaculat(?:e|ed|ing)|orgasm|masturbat(?:e|ed|ing))\b/i,
      /\b(?:child\s+sexual|minor\s+sexual)\b/i,
    ],
  },
  {
    category: "violence_explicit",
    patterns: [
      /\b(?:gore|gory|dismember(?:ed|ment)|decapitat(?:e|ed|ion)|behead(?:ed|ing)?)\b/i,
      /\b(?:bloodbath|graphic\s+violence)\b/i,
      /\b(?:torture|execution|massacre)\b/i,
    ],
  },
  {
    category: "self_harm_explicit",
    patterns: [
      /\b(?:suicide|kill\s+myself|self[-\s]?harm|self[-\s]?injur(?:y|ing)|cutting)\b/i,
      /\b(?:overdose|hanging|wrist\s+slit)\b/i,
    ],
  },
  {
    category: "hate_explicit",
    patterns: [
      /\b(?:ethnic\s+cleansing|genocide|lynch(?:ing)?)\b/i,
      /\b(?:racial\s+slur|hate\s+crime)\b/i,
      /\b(?:nazi\s+propaganda|white\s+supremacy)\b/i,
    ],
  },
];

export const FAMILY_SUGGESTIVE_PATTERNS: Array<{ category: SafetyCategoryId; patterns: RegExp[] }> =
  [
    {
      category: "sexual_suggestive",
      patterns: [
        /\b(?:nsfw)\b/i,
        /\b(?:nude|naked|topless)\b/i,
        /\b(?:lingerie|cleavage)\b/i,
        /\b(?:sexy|sexualized|sensual|seductive|provocative|erotic)\b/i,
        /\b(?:scantily\s+clad|revealing\s+outfit)\b/i,
      ],
    },
    {
      category: "violence_suggestive",
      patterns: [
        /\b(?:kill|murder|stab|shoot|violent|violence|assault|attack|ambush|gunfire)\b/i,
        /\b(?:blood|weapon|gun|knife|pistol|rifle|handgun|shotgun|firearm|armed|fight|brawl)\b/i,
      ],
    },
    {
      category: "self_harm_suggestive",
      patterns: [
        /\b(?:depressed\s+and\s+want\s+to\s+die|hurt\s+(?:myself|himself|herself|themselves)|end\s+(?:my|his|her|their)\s+life|want\s+to\s+hurt\s+(?:myself|himself|herself|themselves))\b/i,
        /\b(?:self[-\s]?harm\s+thoughts?|suicidal\s+thoughts?|thinking\s+about\s+ending\s+(?:my|his|her|their)\s+life|i\s+do(?:\s+not|n't)\s+want\s+to\s+live|wish(?:ed)?\s+i\s+were\s+dead)\b/i,
      ],
    },
    {
      category: "hate_suggestive",
      patterns: [
        /\b(?:hate\s+speech|racist|bigot(?:ed|ry)?|xenophobic)\b/i,
        /\b(?:demean(?:ing)?\s+(?:group|race|religion|gender))\b/i,
      ],
    },
  ];

export const SFW_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bnsfw\b/gi, "safe-for-work"],
  [/\b(?:nude|naked|topless)\b/gi, "fully clothed"],
  [/\blingerie\b/gi, "outfit"],
  [/\bcleavage\b/gi, "neckline"],
  [/\b(?:sexy|sexualized|sensual|seductive|provocative|erotic)\b/gi, "stylized"],
  [/\bscantily clad\b/gi, "fully dressed"],
  [/\brevealing outfit\b/gi, "outfit"],
  [/\b(?:kill|murder|stab|shoot|violent|violence|assault|attack|ambush|gunfire)\b/gi, "conflict"],
  [/\barmed\b/gi, "prepared"],
  [
    /\b(?:weapon|gun|knife|pistol|rifle|handgun|shotgun|firearm|fight|brawl)\b/gi,
    "dramatic tension",
  ],
  [/\b(?:blood|gore|dismemberment|decapitation|beheading)\b/gi, "intense scene"],
  [
    /\b(?:suicide|kill myself|self-harm|self harm|self injury|overdose|hurt myself|hurt himself|hurt herself|hurt themselves|end my life|end his life|end her life|end their life)\b/gi,
    "wellness support",
  ],
  [/\bi\s+do(?:\s+not|n't)\s+want\s+to\s+live\b/gi, "they need support"],
  [/\bwish(?:ed)?\s+i\s+were\s+dead\b/gi, "they are in distress"],
  [/\b(?:hate speech|racist|bigot|xenophobic|ethnic cleansing|genocide)\b/gi, "harmful language"],
];
