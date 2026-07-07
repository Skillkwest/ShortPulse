import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileStorageSection } from "../ProfileStorageSection";

describe("ProfileStorageSection", () => {
  it("renders recurring storage add-on cards", () => {
    render(
      <ProfileStorageSection
        activeAddonStorageBytes={100 * 1024 * 1024 * 1024}
        activePlanId="business"
        activePlanClassName="plan-business"
        activeStorageAddons={[
          {
            id: "row-1",
            storageAddonId: "storage_100gb",
            offerId: "offer-1",
            stripeSubscriptionItemId: "si_123",
            storageLimitBytes: 100 * 1024 * 1024 * 1024,
            quantity: 1,
            recurringPriceCents: 2000,
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
            monthly_price_cents: 2000,
            sort_order: 1,
          },
          {
            id: "storage_250gb",
            display_name: "250 GB add-on",
            storage_limit_bytes: 250 * 1024 * 1024 * 1024,
            monthly_price_cents: 3000,
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
    expect(screen.getByText("$20.00")).toBeInTheDocument();
    expect(screen.getByText("Active add-on")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    expect(
      screen.getByText("You can keep one recurring storage add-on active at a time.")
    ).toBeInTheDocument();
    expect(screen.getByText("Replaces your current recurring storage add-on")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to 250 GB" })).toBeEnabled();
    expect(
      screen.getByText("Need more than 1 TB? Contact support for a storage review.")
    ).toBeInTheDocument();
  });

  it("shows plan-ineligible storage add-ons as disabled upgrade options", () => {
    render(
      <ProfileStorageSection
        activeAddonStorageBytes={0}
        activePlanId="starter"
        activePlanClassName="plan-starter"
        activeStorageAddons={[]}
        billingContractLoading={false}
        billingPlansLoading={false}
        currentSubscriptionStorageLimitBytes={5 * 1024 * 1024 * 1024}
        storageAddonChangeLoadingId={null}
        storageAddonManagementState="eligible"
        storageAddons={[
          {
            id: "storage_50gb",
            display_name: "Extra 50 GB",
            storage_limit_bytes: 50 * 1024 * 1024 * 1024,
            monthly_price_cents: 1000,
            sort_order: 1,
          },
          {
            id: "storage_100gb",
            display_name: "Extra 100 GB",
            storage_limit_bytes: 100 * 1024 * 1024 * 1024,
            monthly_price_cents: 2000,
            sort_order: 2,
          },
        ]}
        storageTransactions={[]}
        storageTransactionsError={null}
        storageTransactionsLoading={false}
        totalStorageLimitBytes={5 * 1024 * 1024 * 1024}
        usedStorageBytes={0}
        onStorageAddonChange={vi.fn()}
      />
    );

    const addStorageButton = screen.getByRole("button", { name: "Add 50 GB" });
    expect(addStorageButton).toBeEnabled();
    expect(addStorageButton).toHaveClass("primary-btn");
    expect(screen.getByText("Extra 100 GB")).toBeInTheDocument();
    expect(screen.getByText("Available on Media plan and above")).toBeInTheDocument();
    const requiresMediaButton = screen.getByRole("button", { name: "Requires Media plan" });
    expect(requiresMediaButton).toBeDisabled();
    expect(requiresMediaButton).toHaveClass("ghost-btn");
  });
});
