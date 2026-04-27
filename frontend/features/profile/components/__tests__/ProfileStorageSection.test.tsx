import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileStorageSection } from "../ProfileStorageSection";

describe("ProfileStorageSection", () => {
  it("renders recurring storage add-on cards", () => {
    render(
      <ProfileStorageSection
        activeAddonStorageBytes={100 * 1024 * 1024 * 1024}
        activePlanClassName="plan-business"
        activeStorageAddons={[
          {
            id: "row-1",
            storageAddonId: "addon_100gb",
            offerId: "offer-1",
            stripeSubscriptionItemId: "si_123",
            storageLimitBytes: 100 * 1024 * 1024 * 1024,
            quantity: 1,
            recurringPriceCents: 1500,
            status: "active",
          },
        ]}
        billingContractLoading={false}
        billingPlansLoading={false}
        currentSubscriptionStorageLimitBytes={500 * 1024 * 1024 * 1024}
        storageAddonChangeLoadingId={null}
        storageAddonManagementState="eligible"
        storageAddons={[
          {
            id: "addon_100gb",
            display_name: "100 GB add-on",
            storage_limit_bytes: 100 * 1024 * 1024 * 1024,
            monthly_price_cents: 1500,
            sort_order: 1,
          },
        ]}
        storageTransactions={[]}
        storageTransactionsError={null}
        storageTransactionsLoading={false}
        totalStorageLimitBytes={600 * 1024 * 1024 * 1024}
        usedStorageBytes={50 * 1024 * 1024 * 1024}
        onStorageAddonChange={vi.fn()}
      />
    );

    expect(screen.getAllByText("100 GB add-on").length).toBeGreaterThan(0);
    expect(screen.getByText("$15.00")).toBeInTheDocument();
    expect(screen.getByText("Active add-on")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });
});
