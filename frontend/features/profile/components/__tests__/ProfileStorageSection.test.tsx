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
            storageAddonId: "storage_100gb",
            offerId: "offer-1",
            stripeSubscriptionItemId: "si_123",
            storageLimitBytes: 100 * 1024 * 1024 * 1024,
            quantity: 1,
            recurringPriceCents: 5900,
            status: "active",
          },
        ]}
        billingContractLoading={false}
        billingPlansLoading={false}
        currentSubscriptionStorageLimitBytes={150 * 1024 * 1024 * 1024}
        storageAddonChangeLoadingId={null}
        storageAddonManagementState="eligible"
        storageAddons={[
          {
            id: "storage_100gb",
            display_name: "100 GB add-on",
            storage_limit_bytes: 100 * 1024 * 1024 * 1024,
            monthly_price_cents: 5900,
            sort_order: 1,
          },
          {
            id: "storage_250gb",
            display_name: "250 GB add-on",
            storage_limit_bytes: 250 * 1024 * 1024 * 1024,
            monthly_price_cents: 14900,
            sort_order: 2,
          },
        ]}
        storageTransactions={[]}
        storageTransactionsError={null}
        storageTransactionsLoading={false}
        totalStorageLimitBytes={250 * 1024 * 1024 * 1024}
        usedStorageBytes={50 * 1024 * 1024 * 1024}
        onStorageAddonChange={vi.fn()}
      />
    );

    expect(screen.getAllByText("100 GB add-on").length).toBeGreaterThan(0);
    expect(screen.getByText("$59.00")).toBeInTheDocument();
    expect(screen.getByText("Active add-on")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    expect(
      screen.getByText("You can keep one recurring storage add-on active at a time.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove current add-on first" })).toBeDisabled();
    expect(
      screen.getByText("Need 500 GB or more? Contact support for a storage review.")
    ).toBeInTheDocument();
  });
});
