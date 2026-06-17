import { readGenerationProjectionOwnershipByProviderRequestId } from "../generationProjection";
import { resolveGenerationLineageByProviderRequest } from "../generationLineageResolver";
import { getSupabaseAdmin } from "../supabaseAdmin";
import { isMissingReservationSchemaError, readErrorCode } from "./errorGuards";
import type { ProviderRequestOwnership } from "./types";

const lookupReservationOwnerByProviderRequestId = async ({
  providerRequestId,
  userId = null,
}: {
  providerRequestId: string;
  userId?: string | null;
}): Promise<string | null> => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const query = supabaseAdmin
      .from("ai_credit_reservations")
      .select("user_id")
      .eq("provider_request_id", providerRequestId)
      .order("updated_at", { ascending: false })
      .limit(1);
    const scopedQuery = userId ? query.eq("user_id", userId) : query;
    const { data, error } = await scopedQuery.maybeSingle();
    if (error) {
      if (!isMissingReservationSchemaError(readErrorCode(error), error.message)) {
        console.error("[generationBilling] lookupReservationOwnerByProviderRequestId failed", {
          providerRequestId,
          userId,
          message: error.message,
        });
      }
      return null;
    }
    const ownerUserId = (data as { user_id?: unknown } | null)?.user_id;
    return typeof ownerUserId === "string" && ownerUserId.trim().length ? ownerUserId : null;
  } catch (error) {
    console.error(
      "[generationBilling] lookupReservationOwnerByProviderRequestId threw",
      String(error)
    );
    return null;
  }
};

const lookupLineageOwnerByProviderRequestId = async ({
  providerRequestId,
  userId = null,
}: {
  providerRequestId: string;
  userId?: string | null;
}): Promise<string | null> => {
  try {
    const lineage = await resolveGenerationLineageByProviderRequest({
      providerRequestId,
      userId,
      includeProjection: true,
    });
    const ownerUserId = lineage.userId;
    return typeof ownerUserId === "string" && ownerUserId.trim().length ? ownerUserId : null;
  } catch (error) {
    console.error("[generationBilling] lookupLineageOwnerByProviderRequestId threw", String(error));
    return null;
  }
};

const lookupProjectionOwnersByProviderRequestId = async (
  providerRequestId: string
): Promise<string[]> => {
  try {
    const projectionOwnership = await readGenerationProjectionOwnershipByProviderRequestId({
      providerRequestId,
    });
    return projectionOwnership.userIds;
  } catch (error) {
    console.error(
      "[generationBilling] lookupProjectionOwnersByProviderRequestId threw",
      String(error)
    );
    return [];
  }
};

/**
 * Resolves whether a provider request id is owned by the current user.
 * "unknown" means ownership could not be proven from canonical reservation/generation records.
 */
export const resolveProviderRequestOwnership = async ({
  userId,
  providerRequestId,
}: {
  userId: string;
  providerRequestId: string;
}): Promise<ProviderRequestOwnership> => {
  const normalized = providerRequestId.trim();
  if (!normalized) return "unknown";

  const reservationOwnerForUser = await lookupReservationOwnerByProviderRequestId({
    providerRequestId: normalized,
    userId,
  });
  if (reservationOwnerForUser === userId) {
    return "owned";
  }

  const lineageOwnerForUser = await lookupLineageOwnerByProviderRequestId({
    providerRequestId: normalized,
    userId,
  });
  if (lineageOwnerForUser === userId) {
    return "owned";
  }

  const reservationOwner = await lookupReservationOwnerByProviderRequestId({
    providerRequestId: normalized,
  });
  if (reservationOwner) {
    return reservationOwner === userId ? "owned" : "forbidden";
  }

  const lineageOwner = await lookupLineageOwnerByProviderRequestId({
    providerRequestId: normalized,
  });
  if (lineageOwner) {
    return lineageOwner === userId ? "owned" : "forbidden";
  }

  const projectionOwners = await lookupProjectionOwnersByProviderRequestId(normalized);
  if (projectionOwners.length) {
    return projectionOwners.includes(userId) ? "unknown" : "forbidden";
  }

  return "unknown";
};
