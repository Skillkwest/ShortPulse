/**
 * Admin legal policy workspace types.
 * Mirrors the admin legal policy API payloads without coupling UI state to server internals.
 */
import type { LegalPolicySlug } from "../../legal/data/legalPolicies";

export type AdminLegalPolicyHistoryEntry = {
  version: number;
  versionId: number;
  note: string | null;
  createdAt: string | null;
  createdByEmail: string | null;
  isActive: boolean;
};

export type AdminLegalPolicyDocument = {
  slug: LegalPolicySlug;
  markdown: string;
  version: number | null;
  versionId: number | null;
  note: string | null;
  source: "control_plane" | "seed";
  updatedAt: string | null;
  updatedByEmail: string | null;
  degraded: boolean;
  history: AdminLegalPolicyHistoryEntry[];
};
