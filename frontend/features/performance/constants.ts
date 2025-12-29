/**
 * Performance analytics constants.
 * Houses thresholds, display copy, and reusable fixture assets shared across performance UI elements.
 * Imported by the page, chart components, and sample data builders to keep baseline values consistent.
 */
import { DateOption, Niche } from "./types";

export const SCRAPE_CADENCE = "Daily scrape · 00:00 UTC";
export const SCRAPE_NOTE = "Scrape pipeline not yet wired; displaying sample cohort.";
export const OUTLIER_MULTIPLIER_THRESHOLD = 3;
export const BREAKOUT_SCORE = 95;

export const SAMPLE_IMAGES = [
  "https://images.pexels.com/photos/3756766/pexels-photo-3756766.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/2608517/pexels-photo-2608517.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/1181622/pexels-photo-1181622.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/3771836/pexels-photo-3771836.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/3807517/pexels-photo-3807517.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/1181352/pexels-photo-1181352.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/3937174/pexels-photo-3937174.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/6335029/pexels-photo-6335029.jpeg?auto=compress&cs=tinysrgb&w=600",
  "https://images.pexels.com/photos/574070/pexels-photo-574070.jpeg?auto=compress&cs=tinysrgb&w=600",
];

export const NICHES: Niche[] = [
  { value: "Religion", label: "Religion", tone: "premium" },
  { value: "Spirituality", label: "Spirituality", tone: "premium" },
  { value: "Wisdom", label: "Wisdom", tone: "premium" },
  { value: "Health & Fitness", label: "Health & Fitness", tone: "premium" },
  { value: "Pets", label: "Pets", tone: "premium" },
  { value: "Vikings", label: "Vikings", tone: "premium" },
  { value: "AI News & Tools", label: "AI News & Tools", tone: "premium" },
  { value: "Consumer", label: "Consumer", tone: "premium" },
  { value: "Adorable", label: "Adorable", tone: "premium" },
  { value: "AI Vlogs", label: "AI Vlogs", tone: "premium" },
  { value: "Fantasy", label: "Fantasy", tone: "entertainment" },
  { value: "Hybrid & Fusion", label: "Hybrid & Fusion", tone: "entertainment" },
  { value: "History", label: "History", tone: "entertainment" },
  { value: "Bizarre", label: "Bizarre", tone: "entertainment" },
  { value: "Horror", label: "Horror", tone: "entertainment" },
  { value: "Luxury", label: "Luxury", tone: "entertainment" },
  { value: "Shocking Realistic", label: "SHOCKING \"Realistic\"", tone: "entertainment" },
];

export const DATE_OPTIONS: DateOption[] = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
];
