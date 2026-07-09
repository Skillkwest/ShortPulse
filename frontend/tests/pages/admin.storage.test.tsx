import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminStoragePage, { getServerSideProps } from "../../pages/admin/storage";

describe("Admin storage page", () => {
  it("is parked at the route boundary", async () => {
    await expect(getServerSideProps({} as never)).resolves.toEqual({ notFound: true });
  });

  it("does not render the storage dashboard when imported directly", () => {
    render(<AdminStoragePage />);

    expect(screen.queryByRole("heading", { name: "Storage" })).not.toBeInTheDocument();
    expect(screen.queryByText("Storage intelligence")).not.toBeInTheDocument();
    expect(screen.queryByText("Supabase usage")).not.toBeInTheDocument();
  });
});
