/**
 * Types for the Saved Creators feature module.
 */
export type Platform = "Instagram" | "TikTok" | "YouTube";

export type Creator = {
  id: string;
  handle: string;
  platform: Platform;
  followers: number;
  avgViews: number;
  videosTracked: number;
  avatarUrl?: string | null;
};

export type UsageStats = {
  used: number;
  limit: number;
};

export type PlanUsage = {
  label: string;
  name: string;
};
