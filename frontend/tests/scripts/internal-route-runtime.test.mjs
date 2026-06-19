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

    expect(billingRoute).toBeTruthy();
    expect(
      shouldSkipAuthenticatedProbe({
        route: billingRoute,
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
    ]);
    const routes = resolveRoutes(args.routeIds);

    expect(() => assertAllowedProbePlan({ routes, args, explicitRouteSelection: true })).toThrow(
      /can mutate data/
    );
  });

  it("allows selected mutating auth probes when explicitly approved", () => {
    const args = parseArgs([
      "--base-url",
      "https://www.shortpulse.ai",
      "--route",
      "billing_renewals",
      "--allow-mutating-auth",
    ]);
    const routes = resolveRoutes(args.routeIds);

    expect(() =>
      assertAllowedProbePlan({ routes, args, explicitRouteSelection: true })
    ).not.toThrow();
  });
});
