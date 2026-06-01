import { lookupGenerationAttemptByProviderRequest } from "../generationAttempts";
import { readGenerationProjectionOwnershipByProviderRequestId } from "../generationProjection";
import { getSupabaseAdmin } from "../supabaseAdmin";
import {
  isMissingGenerationAttemptSchemaError,
  isMissingReservationSchemaError,
  readErrorCode,
} from "./errorGuards";
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

const lookupAttemptOwnerByProviderRequestId = async ({
  providerRequestId,
  userId = null,
}: {
  providerRequestId: string;
  userId?: string | null;
}): Promise<string | null> => {
  try {
    const { data, error } = await lookupGenerationAttemptByProviderRequest({
      providerRequestId,
      userId,
    });
    if (error) {
      if (!isMissingGenerationAttemptSchemaError(error.code ?? null, error.message ?? undefined)) {
        console.error("[generationBilling] lookupAttemptOwnerByProviderRequestId failed", {
          providerRequestId,
          userId,
          message: error.message ?? null,
        });
      }
      return null;
    }
    const ownerUserId = data?.userId;
    return typeof ownerUserId === "string" && ownerUserId.trim().length ? ownerUserId : null;
  } catch (error) {
    console.error("[generationBilling] lookupAttemptOwnerByProviderRequestId threw", String(error));
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

  const attemptOwnerForUser = await lookupAttemptOwnerByProviderRequestId({
    providerRequestId: normalized,
    userId,
  });
  if (attemptOwnerForUser === userId) {
    return "owned";
  }

  const projectionOwners = await lookupProjectionOwnersByProviderRequestId(normalized);
  if (projectionOwners.includes(userId)) {
    return "owned";
  }

  const reservationOwner = await lookupReservationOwnerByProviderRequestId({
    providerRequestId: normalized,
  });
  if (reservationOwner) {
    return "forbidden";
  }

  const attemptOwner = await lookupAttemptOwnerByProviderRequestId({
    providerRequestId: normalized,
  });
  if (attemptOwner) {
    return "forbidden";
  }

  if (projectionOwners.length) {
    return "forbidden";
  }

  return "unknown";
};
