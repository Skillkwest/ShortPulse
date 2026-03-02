import { getSupabaseAdmin } from "../supabaseAdmin";
import {
  isMissingLedgerSchemaError,
  isMissingReservationSchemaError,
  readErrorCode,
} from "./errorGuards";
import type { ProviderRequestOwnership } from "./types";

const lookupReservationOwnerByProviderRequestId = async (
  providerRequestId: string
): Promise<string | null> => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("ai_credit_reservations")
      .select("user_id")
      .eq("provider_request_id", providerRequestId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (!isMissingReservationSchemaError(readErrorCode(error), error.message)) {
        console.error("[generationBilling] lookupReservationOwnerByProviderRequestId failed", {
          providerRequestId,
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

const lookupLedgerOwnerByProviderRequestId = async (
  providerRequestId: string
): Promise<string | null> => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("ai_credit_ledger")
      .select("user_id")
      .eq("source", "generation_charge")
      .contains("metadata", { provider_request_id: providerRequestId })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (!isMissingLedgerSchemaError(readErrorCode(error), error.message)) {
        console.error("[generationBilling] lookupLedgerOwnerByProviderRequestId failed", {
          providerRequestId,
          message: error.message,
        });
      }
      return null;
    }
    const ownerUserId = (data as { user_id?: unknown } | null)?.user_id;
    return typeof ownerUserId === "string" && ownerUserId.trim().length ? ownerUserId : null;
  } catch (error) {
    console.error("[generationBilling] lookupLedgerOwnerByProviderRequestId threw", String(error));
    return null;
  }
};

const lookupGenerationOwnersByProviderRequestId = async (
  providerRequestId: string
): Promise<string[]> => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("ai_generations")
      .select("user_id")
      .eq("request_id", providerRequestId)
      .limit(20);
    if (error) {
      console.error("[generationBilling] lookupGenerationOwnersByProviderRequestId failed", {
        providerRequestId,
        message: error.message,
      });
      return [];
    }
    if (!Array.isArray(data)) return [];
    return Array.from(
      new Set(
        data
          .map((row) => (row as { user_id?: unknown } | null)?.user_id)
          .filter((userId): userId is string => typeof userId === "string" && userId.length > 0)
      )
    );
  } catch (error) {
    console.error(
      "[generationBilling] lookupGenerationOwnersByProviderRequestId threw",
      String(error)
    );
    return [];
  }
};

/**
 * Resolves whether a provider request id is owned by the current user.
 * "unknown" means ownership could not be proven from persisted reservation/ledger records.
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

  const reservationOwner = await lookupReservationOwnerByProviderRequestId(normalized);
  if (reservationOwner) {
    return reservationOwner === userId ? "owned" : "forbidden";
  }

  const ledgerOwner = await lookupLedgerOwnerByProviderRequestId(normalized);
  if (ledgerOwner) {
    return ledgerOwner === userId ? "owned" : "forbidden";
  }

  const generationOwners = await lookupGenerationOwnersByProviderRequestId(normalized);
  if (generationOwners.length) {
    return generationOwners.includes(userId) ? "owned" : "forbidden";
  }

  return "unknown";
};
