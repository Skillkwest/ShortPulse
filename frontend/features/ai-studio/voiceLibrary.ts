/**
 * Shared voice-library catalog.
 * Provides the canonical saved-voice metadata used by selector surfaces across AI Studio.
 */

export type VoiceLibraryOption = {
  value: string;
  title: string;
  descriptor: string;
};

export const VOICE_LIBRARY_OPTIONS: readonly VoiceLibraryOption[] = [
  { value: "darian", title: "Darian", descriptor: "Warm Grounded Storyteller" },
  { value: "talia", title: "Talia", descriptor: "Warm Soft Guide" },
  { value: "elara", title: "Elara", descriptor: "Crisp Pro Narrator" },
  { value: "baxter", title: "Baxter", descriptor: "Dry Calm Aussie" },
  { value: "eldrin", title: "Eldrin", descriptor: "Crisp British Baritone" },
  { value: "kellan", title: "Kellan", descriptor: "Casual Friendly Speaker" },
  { value: "elowen", title: "Elowen", descriptor: "Upbeat Modern Narrator" },
  { value: "kaelen", title: "Kaelen", descriptor: "Amateur Warrior" },
  { value: "lawrence", title: "Lawrence", descriptor: "Bright and Informative" },
  { value: "alicia", title: "Alicia", descriptor: "Polished Global Anchor" },
  { value: "maisie", title: "Maisie", descriptor: "Friendly Casual Neighbor" },
  { value: "warren", title: "Warren", descriptor: "Effortless and Cool" },
  { value: "jade", title: "Jade", descriptor: "Upbeat and Natural" },
  { value: "eddie", title: "Eddie", descriptor: "Helpful and Comforting" },
  { value: "caleb", title: "Caleb", descriptor: "Trusted Guide" },
  { value: "sawyer", title: "Sawyer", descriptor: "Midnight Storyteller" },
  { value: "finley", title: "Finley", descriptor: "Articulate Anchor" },
  { value: "florence", title: "Florence", descriptor: "Atmospheric Storyteller" },
  { value: "wyatt", title: "Wyatt", descriptor: "Seasoned Mentor" },
] as const;
