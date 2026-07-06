import { describe, expect, it } from "vitest";
import {
  assertAllowedProbePlan,
  DEFAULT_ROUTE_CONFIGS,
  parseArgs,
  resolveRoutes,
  shouldSkipAuthenticatedProbe,
} from "../../../scripts/verify_internal_route_runtime.mjs";

describe("internal route runtime launch gate", () => {
  it("skips mutating billing auth probes in the default route sweep", () => {
    const args = parseArgs(["--base-url", "https://www.shortpulse.ai"]);
    const billingRoute = DEFAULT_ROUTE_CONFIGS.find((route) => route.id === "billing_renewals");
    const expirationRoute = DEFAULT_ROUTE_CONFIGS.find(
      (route) => route.id === "credit_expirations"
    );

    expect(billingRoute).toBeTruthy();
    expect(
      shouldSkipAuthenticatedProbe({
        route: billingRoute,
        args,
        explicitRouteSelection: false,
      })
    ).toBe(true);
    expect(expirationRoute).toBeTruthy();
    expect(
      shouldSkipAuthenticatedProbe({
        route: expirationRoute,
        args,
        explicitRouteSelection: false,
      })
    ).toBe(true);
  });

  it("requires an explicit allow flag for selected mutating auth probes", () => {
    const args = parseArgs([
      "--base-url",
      "https://www.shortpulse.ai",
      "--route",
      "billing_renewals",
      "--route",
      "credit_expirations",
    ]);
    const routes = resolveRoutes(args.routeIds);

    expect(() => assertAllowedProbePlan({ routes, args, explicitRouteSelection: true })).toThrow(
      /billing_renewals, credit_expirations/
    );
  });

  it("allows selected mutating auth probes when explicitly approved", () => {
    const args = parseArgs([
      "--base-url",
      "https://www.shortpulse.ai",
      "--route",
      "billing_renewals",
      "--route",
      "credit_expirations",
      "--allow-mutating-auth",
    ]);
    const routes = resolveRoutes(args.routeIds);

    expect(() =>
      assertAllowedProbePlan({ routes, args, explicitRouteSelection: true })
    ).not.toThrow();
  });
});
