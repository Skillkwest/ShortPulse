/**
 * Generation-access CTA policy for authenticated AI Studio users.
 * Keeps no-plan subscription gating tied to the resolved billing account summary.
 */
import { normalizePlanId } from "../../billing/catalog";
import type { ResolvedAccountPlanStatus } from "../../billing/useResolvedAccountPlan";

export type GenerationAccessCta = {
  label: string;
  href: string;
  ariaLabel: string;
};

type ResolvedPlanLike = {
  id: string;
} | null;

export const AI_STUDIO_PLAN_CTA: GenerationAccessCta = {
  label: "View plans",
  href: "/pricing",
  ariaLabel: "View subscription plans",
};

export const AI_STUDIO_MEDIA_PLAN_REQUIRED_MESSAGE =
  "Choose a plan to add media to your Reference Grid and Media Library.";

/**
 * Returns the shared plan CTA only after billing confirms baseline access.
 */
export const resolveGenerationAccessCta = ({
  resolvedPlan,
  status,
}: {
  resolvedPlan: ResolvedPlanLike;
  status: ResolvedAccountPlanStatus;
}): GenerationAccessCta | null => {
  if (status !== "ready" || !resolvedPlan) return null;
  return normalizePlanId(resolvedPlan.id) === "free" ? AI_STUDIO_PLAN_CTA : null;
};
