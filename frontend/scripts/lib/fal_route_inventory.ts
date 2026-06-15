import { listModelCatalogEntries, type ModelProvider } from "../../lib/model-runtime/modelCatalog";

export type FalRouteInventoryEntry = {
  modelId: string;
  provider: Extract<ModelProvider, "fal" | "kie">;
  fileBase: string | null;
};

export const FAL_ROUTE_INVENTORY: FalRouteInventoryEntry[] = listModelCatalogEntries()
  .filter(
    (entry) =>
      entry.executionMode === "queued" &&
      (entry.provider === "fal" || entry.provider === "kie") &&
      ((entry.lifecycle === "active" && entry.surfaces?.includes("runtime")) ||
        (entry.lifecycle !== "active" && Boolean(entry.replacementModelId)))
  )
  .map((entry) => ({
    modelId: entry.modelId,
    provider: entry.provider as Extract<ModelProvider, "fal" | "kie">,
    fileBase: entry.apiRouteSlug ?? null,
  }))
  .sort((a, b) => a.modelId.localeCompare(b.modelId));
