import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileStorageSection } from "../ProfileStorageSection";

describe("ProfileStorageSection", () => {
  it("renders recurring storage add-on cards", () => {
    render(
      <ProfileStorageSection
        activeAddonStorageBytes={100 * 1024 * 1024 * 1024}
        billingContractLoading={false}
        billingPlansLoading={false}
        currentSubscriptionStorageLimitBytes={500 * 1024 * 1024 * 1024}
        planLabel="Business"
        portalActionLabel="Manage in billing portal"
        portalLoading={false}
        portalManagementAvailable={true}
        storageAddons={[
          {
            id: "addon_100gb",
            display_name: "100 GB add-on",
            storage_limit_bytes: 100 * 1024 * 1024 * 1024,
            monthly_price_cents: 1500,
            sort_order: 1,
          },
        ]}
        totalStorageLimitBytes={600 * 1024 * 1024 * 1024}
        usedStorageBytes={50 * 1024 * 1024 * 1024}
        onOpenBillingPortal={vi.fn()}
      />
    );

    expect(screen.getByText("100 GB add-on")).toBeInTheDocument();
    expect(screen.getByText("$15.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage in billing portal" })).toBeInTheDocument();
  });
});
