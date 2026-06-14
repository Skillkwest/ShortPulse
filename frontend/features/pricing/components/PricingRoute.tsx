/**
 * Public pricing route entry.
 * Keeps anonymous pricing lightweight while loading session awareness only when local auth hints warrant it.
 */
import { useEffect, useState, type ComponentType } from "react";
import { readSupabaseSessionBootstrapHint } from "../../../lib/supabaseSessionHints";
import { PricingRouteContent, type PricingRouteProps } from "./PricingRouteContent";

type PricingRouteSessionAwareComponent = ComponentType<PricingRouteProps>;

let cachedPricingRouteSessionAwareComponent: PricingRouteSessionAwareComponent | null = null;

const loadPricingRouteSessionAware = async (): Promise<PricingRouteSessionAwareComponent> => {
  if (cachedPricingRouteSessionAwareComponent) {
    return cachedPricingRouteSessionAwareComponent;
  }

  const loadedModule = await import("./PricingRouteSessionAware");
  cachedPricingRouteSessionAwareComponent = loadedModule.PricingRouteSessionAware;
  return loadedModule.PricingRouteSessionAware;
};

if (typeof window !== "undefined" && readSupabaseSessionBootstrapHint()) {
  void loadPricingRouteSessionAware();
}

/**
 * Renders the public pricing route.
 */
export function PricingRoute({ billingCatalog }: PricingRouteProps) {
  const [shouldResolveSession, setShouldResolveSession] = useState(false);
  const [loadedSessionAwareComponent, setLoadedSessionAwareComponent] =
    useState<PricingRouteSessionAwareComponent | null>(null);

  useEffect(() => {
    if (!readSupabaseSessionBootstrapHint()) return undefined;
    const timeoutId = window.setTimeout(() => {
      setShouldResolveSession(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!shouldResolveSession) return;
    if (cachedPricingRouteSessionAwareComponent || loadedSessionAwareComponent) {
      return;
    }

    let cancelled = false;
    void loadPricingRouteSessionAware().then((component) => {
      if (!cancelled) {
        setLoadedSessionAwareComponent(() => component);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadedSessionAwareComponent, shouldResolveSession]);

  const SessionAwareComponent = shouldResolveSession
    ? (loadedSessionAwareComponent ?? cachedPricingRouteSessionAwareComponent)
    : null;

  if (!shouldResolveSession || !SessionAwareComponent) {
    return <PricingRouteContent billingCatalog={billingCatalog} isAuthenticated={false} />;
  }

  return <SessionAwareComponent billingCatalog={billingCatalog} />;
}
