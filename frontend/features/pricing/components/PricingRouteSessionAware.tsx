/**
 * Session-aware pricing route wrapper.
 * Loads the shared client auth state only for visitors whose local browser hints suggest an existing session.
 */
import { useSupabaseSessionState } from "../../../lib/supabaseClient";
import { PricingRouteContent, type PricingRouteProps } from "./PricingRouteContent";

/**
 * Renders the pricing route with live authenticated-state awareness.
 */
export function PricingRouteSessionAware({ billingCatalog }: PricingRouteProps) {
  const { user } = useSupabaseSessionState({
    enabled: true,
  });

  return <PricingRouteContent billingCatalog={billingCatalog} isAuthenticated={Boolean(user)} />;
}
