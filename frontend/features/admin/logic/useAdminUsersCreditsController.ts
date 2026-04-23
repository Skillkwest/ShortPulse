/**
 * Admin users and credits controller.
 * Owns the admin landing-page user search, selection, credit ledger loading, and manual adjustment flows.
 */
import React from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type {
  AdminBillingDiagnosticsResponse,
  AdminCreditLedgerRow,
  AdminDeleteUserResponse,
  AdminPagination,
  AdminUserRow,
} from "../types";

export const ADMIN_DASHBOARD_USERS_PER_PAGE = 50;
export const ADMIN_DASHBOARD_CREDIT_LEDGER_LIMIT = 20;
export const ADMIN_DASHBOARD_ADJUSTMENT_PRESETS = [100, 500, 1000, -100, -500, -1000] as const;
const SEARCH_DEBOUNCE_MS = 250;

const sanitizeSignedIntegerInput = (rawValue: string): string => {
  const compact = rawValue.replace(/\s+/g, "");
  if (!compact.length) return "";
  const sign = compact.startsWith("+") || compact.startsWith("-") ? compact.charAt(0) : "";
  const digits = compact.slice(sign ? 1 : 0).replace(/\D/g, "");
  return `${sign}${digits}`;
};

const parseAdjustmentInput = (rawValue: string): number | null => {
  const normalized = sanitizeSignedIntegerInput(rawValue);
  if (!normalized || normalized === "+" || normalized === "-") return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  const whole = Math.trunc(parsed);
  if (whole === 0) return null;
  return whole;
};

type UseAdminUsersCreditsControllerParams = {
  enabled: boolean;
  currentAdminUserId: string;
};

type UseAdminUsersCreditsControllerResult = {
  userSearch: string;
  usersPagination: AdminPagination;
  userSearchLimited: boolean;
  users: AdminUserRow[];
  usersLoading: boolean;
  usersError: string | null;
  selectedUserId: string;
  adjustment: string;
  adjustSubmitting: boolean;
  adjustResult: string | null;
  internalCompPlan: string;
  internalCompReason: string;
  allowStripeTakeover: boolean;
  billingOverrideSubmitting: boolean;
  billingOverrideResult: string | null;
  deleteSubmitting: boolean;
  deleteResult: string | null;
  creditLedgerRows: AdminCreditLedgerRow[];
  creditLedgerLoading: boolean;
  creditLedgerError: string | null;
  creditLedgerLoaded: boolean;
  billingDiagnostics: AdminBillingDiagnosticsResponse | null;
  billingDiagnosticsLoading: boolean;
  billingDiagnosticsError: string | null;
  billingDiagnosticsLoaded: boolean;
  usersResultStart: number;
  usersResultEnd: number;
  setSelectedUserId: React.Dispatch<React.SetStateAction<string>>;
  loadUsers: () => Promise<void>;
  loadCreditLedger: () => Promise<void>;
  loadBillingDiagnostics: () => Promise<void>;
  handleUserSearchChange: (value: string) => void;
  handlePreviousUsersPage: () => void;
  handleNextUsersPage: () => void;
  handleAdjustmentChange: (value: string) => void;
  handleInternalCompPlanChange: (value: string) => void;
  handleInternalCompReasonChange: (value: string) => void;
  handleAllowStripeTakeoverChange: (value: boolean) => void;
  applyAdjustmentPreset: (delta: number) => void;
  handleCreditAdjust: () => Promise<void>;
  handleGrantInternalComp: () => Promise<void>;
  handleRevokeInternalComp: () => Promise<void>;
  handleDeleteUser: (params: { userId: string; confirmationText: string }) => Promise<boolean>;
  clearDeleteResult: () => void;
};

/**
 * Compose the admin users/credits support workflow behind a route-local controller boundary.
 */
export const useAdminUsersCreditsController = ({
  enabled,
  currentAdminUserId,
}: UseAdminUsersCreditsControllerParams): UseAdminUsersCreditsControllerResult => {
  const [userSearch, setUserSearch] = React.useState("");
  const [debouncedUserSearch, setDebouncedUserSearch] = React.useState("");
  const [usersPage, setUsersPage] = React.useState(1);
  const [usersPagination, setUsersPagination] = React.useState<AdminPagination>({
    page: 1,
    perPage: ADMIN_DASHBOARD_USERS_PER_PAGE,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [userSearchLimited, setUserSearchLimited] = React.useState(false);
  const [users, setUsers] = React.useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = React.useState(false);
  const [usersError, setUsersError] = React.useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = React.useState<string>("");
  const [adjustment, setAdjustment] = React.useState<string>("");
  const [adjustSubmitting, setAdjustSubmitting] = React.useState(false);
  const [adjustResult, setAdjustResult] = React.useState<string | null>(null);
  const [internalCompPlan, setInternalCompPlan] = React.useState<string>("business");
  const [internalCompReason, setInternalCompReason] = React.useState<string>("");
  const [allowStripeTakeover, setAllowStripeTakeover] = React.useState(false);
  const [billingOverrideSubmitting, setBillingOverrideSubmitting] = React.useState(false);
  const [billingOverrideResult, setBillingOverrideResult] = React.useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false);
  const [deleteResult, setDeleteResult] = React.useState<string | null>(null);
  const [creditLedgerRows, setCreditLedgerRows] = React.useState<AdminCreditLedgerRow[]>([]);
  const [creditLedgerLoading, setCreditLedgerLoading] = React.useState(false);
  const [creditLedgerError, setCreditLedgerError] = React.useState<string | null>(null);
  const [creditLedgerLoaded, setCreditLedgerLoaded] = React.useState(false);
  const [billingDiagnostics, setBillingDiagnostics] =
    React.useState<AdminBillingDiagnosticsResponse | null>(null);
  const [billingDiagnosticsLoading, setBillingDiagnosticsLoading] = React.useState(false);
  const [billingDiagnosticsError, setBillingDiagnosticsError] = React.useState<string | null>(null);
  const [billingDiagnosticsLoaded, setBillingDiagnosticsLoaded] = React.useState(false);

  const loadUsers = React.useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(usersPage));
      params.set("perPage", String(ADMIN_DASHBOARD_USERS_PER_PAGE));
      if (debouncedUserSearch.trim()) {
        params.set("search", debouncedUserSearch.trim());
      }

      const response = await fetchWithAuth(`/api/admin/users?${params.toString()}`, {
        method: "GET",
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details?.error || "Failed to load users.");
      }
      const data = (await response.json()) as {
        users?: AdminUserRow[];
        pagination?: Partial<AdminPagination>;
        search?: { limited?: boolean };
      };
      const resolvedPage = Number(data.pagination?.page ?? usersPage);
      setUsers(data.users ?? []);
      setUsersPagination({
        page: resolvedPage,
        perPage: Number(data.pagination?.perPage ?? ADMIN_DASHBOARD_USERS_PER_PAGE),
        totalCount: Number(data.pagination?.totalCount ?? 0),
        totalPages: Number(data.pagination?.totalPages ?? 1),
        hasNextPage: Boolean(data.pagination?.hasNextPage),
        hasPrevPage: Boolean(data.pagination?.hasPrevPage),
      });
      setUserSearchLimited(Boolean(data.search?.limited));
      if (resolvedPage !== usersPage) {
        setUsersPage(resolvedPage);
      }
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : "Failed to load users.");
    } finally {
      setUsersLoading(false);
    }
  }, [debouncedUserSearch, usersPage]);

  const loadCreditLedger = React.useCallback(async () => {
    if (!selectedUserId) {
      setCreditLedgerRows([]);
      setCreditLedgerError(null);
      setCreditLedgerLoaded(false);
      return;
    }

    setCreditLedgerLoading(true);
    setCreditLedgerError(null);
    try {
      const params = new URLSearchParams();
      params.set("userId", selectedUserId);
      params.set("limit", String(ADMIN_DASHBOARD_CREDIT_LEDGER_LIMIT));

      const response = await fetchWithAuth(`/api/admin/credits/ledger?${params.toString()}`, {
        method: "GET",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        transactions?: unknown[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load credit transactions.");
      }

      const rows = Array.isArray(payload.transactions)
        ? payload.transactions.map((item) => {
            const value = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
            const breakdownValue =
              value.pricingBreakdown && typeof value.pricingBreakdown === "object"
                ? (value.pricingBreakdown as Record<string, unknown>)
                : null;
            return {
              id: String(value.id ?? ""),
              userId: String(value.userId ?? selectedUserId),
              changeCents: Number(value.changeCents ?? 0),
              reason: typeof value.reason === "string" ? value.reason : "",
              source: typeof value.source === "string" ? value.source : "system",
              sourceRef: typeof value.sourceRef === "string" ? value.sourceRef : null,
              pricingBreakdown: breakdownValue
                ? {
                    usdRaw: Number.isFinite(Number(breakdownValue.usdRaw))
                      ? Number(breakdownValue.usdRaw)
                      : null,
                    rawCredits: Number.isFinite(Number(breakdownValue.rawCredits))
                      ? Number(breakdownValue.rawCredits)
                      : null,
                    billedCredits: Number.isFinite(Number(breakdownValue.billedCredits))
                      ? Number(breakdownValue.billedCredits)
                      : null,
                    billedUsd: Number.isFinite(Number(breakdownValue.billedUsd))
                      ? Number(breakdownValue.billedUsd)
                      : null,
                  }
                : null,
              createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
            };
          })
        : [];
      setCreditLedgerRows(rows);
      setCreditLedgerLoaded(true);
    } catch (error) {
      setCreditLedgerError(
        error instanceof Error ? error.message : "Failed to load credit transactions."
      );
      setCreditLedgerRows([]);
      setCreditLedgerLoaded(false);
    } finally {
      setCreditLedgerLoading(false);
    }
  }, [selectedUserId]);

  const loadBillingDiagnostics = React.useCallback(async () => {
    if (!selectedUserId) {
      setBillingDiagnostics(null);
      setBillingDiagnosticsError(null);
      setBillingDiagnosticsLoaded(false);
      return;
    }

    setBillingDiagnosticsLoading(true);
    setBillingDiagnosticsError(null);
    try {
      const params = new URLSearchParams();
      params.set("userId", selectedUserId);
      const response = await fetchWithAuth(`/api/admin/billing-diagnostics?${params.toString()}`, {
        method: "GET",
      });
      const payload = (await response.json().catch(() => ({}))) as
        | AdminBillingDiagnosticsResponse
        | { error?: string };
      if (!response.ok) {
        throw new Error(
          typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "Failed to load billing diagnostics."
        );
      }

      setBillingDiagnostics(payload as AdminBillingDiagnosticsResponse);
      setBillingDiagnosticsLoaded(true);
    } catch (error) {
      setBillingDiagnostics(null);
      setBillingDiagnosticsLoaded(false);
      setBillingDiagnosticsError(
        error instanceof Error ? error.message : "Failed to load billing diagnostics."
      );
    } finally {
      setBillingDiagnosticsLoading(false);
    }
  }, [selectedUserId]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedUserSearch(userSearch), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [userSearch]);

  React.useEffect(() => {
    if (!enabled) return;
    void loadUsers();
  }, [enabled, loadUsers]);

  React.useEffect(() => {
    if (!selectedUserId) return;
    const selectedStillExists = users.some((row) => row.id === selectedUserId);
    if (!selectedStillExists) {
      setSelectedUserId("");
    }
  }, [selectedUserId, users]);

  React.useEffect(() => {
    if (selectedUserId || !currentAdminUserId) return;
    const currentAdminRow = users.find((row) => row.id === currentAdminUserId);
    if (currentAdminRow) {
      setSelectedUserId(currentAdminRow.id);
    }
  }, [currentAdminUserId, selectedUserId, users]);

  React.useEffect(() => {
    setCreditLedgerRows([]);
    setCreditLedgerError(null);
    setCreditLedgerLoaded(false);
    setBillingDiagnostics(null);
    setBillingDiagnosticsError(null);
    setBillingDiagnosticsLoaded(false);
    setBillingOverrideResult(null);
    setAllowStripeTakeover(false);
  }, [selectedUserId]);

  React.useEffect(() => {
    if (!selectedUserId) {
      setInternalCompPlan("business");
      setInternalCompReason("");
      return;
    }
    const selectedUser = users.find((row) => row.id === selectedUserId) ?? null;
    const nextPlanId =
      selectedUser?.planId === "media" ||
      selectedUser?.planId === "studio" ||
      selectedUser?.planId === "business"
        ? selectedUser.planId
        : "business";
    setInternalCompPlan(nextPlanId);
    setInternalCompReason("");
  }, [selectedUserId, users]);

  React.useEffect(() => {
    if (!selectedUserId) return;
    void loadBillingDiagnostics();
  }, [loadBillingDiagnostics, selectedUserId]);

  const handleCreditAdjust = React.useCallback(async () => {
    const normalized = parseAdjustmentInput(adjustment);
    if (!selectedUserId || normalized === null) {
      setAdjustResult("Pick a user and enter a non-zero credit amount.");
      return;
    }

    setAdjustSubmitting(true);
    setAdjustResult(null);
    try {
      const response = await fetchWithAuth("/api/admin/credits/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          changeCents: normalized,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Credit adjustment failed.");
      }

      setAdjustment("");
      setAdjustResult("Credit adjustment applied.");
      await Promise.all([loadUsers(), loadCreditLedger()]);
    } catch (error) {
      setAdjustResult(error instanceof Error ? error.message : "Credit adjustment failed.");
    } finally {
      setAdjustSubmitting(false);
    }
  }, [adjustment, loadCreditLedger, loadUsers, selectedUserId]);

  const handleGrantInternalComp = React.useCallback(async () => {
    if (!selectedUserId) {
      setBillingOverrideResult("Pick a user before applying internal comp access.");
      return;
    }
    if (
      internalCompPlan !== "media" &&
      internalCompPlan !== "studio" &&
      internalCompPlan !== "business"
    ) {
      setBillingOverrideResult("Choose Media, Studio, or Business for internal comp access.");
      return;
    }

    setBillingOverrideSubmitting(true);
    setBillingOverrideResult(null);
    try {
      const response = await fetchWithAuth("/api/admin/billing/contracts/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          action: "grant_internal_comp",
          planId: internalCompPlan,
          grantReason: internalCompReason,
          allowStripeTakeover,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        creditsGrantedCents?: number;
      };
      if (!response.ok) {
        throw new Error(data.error || "Internal comp update failed.");
      }
      const grantedCredits = Number(data.creditsGrantedCents ?? 0);
      setBillingOverrideResult(
        grantedCredits > 0
          ? `Internal comp access applied and ${grantedCredits.toLocaleString()} credits were seeded.`
          : "Internal comp access applied."
      );
      await Promise.all([loadUsers(), loadBillingDiagnostics(), loadCreditLedger()]);
    } catch (error) {
      setBillingOverrideResult(
        error instanceof Error ? error.message : "Internal comp update failed."
      );
    } finally {
      setBillingOverrideSubmitting(false);
    }
  }, [
    allowStripeTakeover,
    internalCompPlan,
    internalCompReason,
    loadBillingDiagnostics,
    loadCreditLedger,
    loadUsers,
    selectedUserId,
  ]);

  const handleRevokeInternalComp = React.useCallback(async () => {
    if (!selectedUserId) {
      setBillingOverrideResult("Pick a user before revoking internal comp access.");
      return;
    }

    setBillingOverrideSubmitting(true);
    setBillingOverrideResult(null);
    try {
      const response = await fetchWithAuth("/api/admin/billing/contracts/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          action: "revoke_internal_comp",
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Internal comp revoke failed.");
      }
      setBillingOverrideResult(
        "Internal comp access removed and the account was returned to Free."
      );
      await Promise.all([loadUsers(), loadBillingDiagnostics(), loadCreditLedger()]);
    } catch (error) {
      setBillingOverrideResult(
        error instanceof Error ? error.message : "Internal comp revoke failed."
      );
    } finally {
      setBillingOverrideSubmitting(false);
    }
  }, [loadBillingDiagnostics, loadCreditLedger, loadUsers, selectedUserId]);

  const handleDeleteUser = React.useCallback(
    async ({
      userId,
      confirmationText,
    }: {
      userId: string;
      confirmationText: string;
    }): Promise<boolean> => {
      if (!userId.trim()) {
        setDeleteResult("Pick a user before deleting.");
        return false;
      }

      setDeleteSubmitting(true);
      setDeleteResult(null);
      try {
        const response = await fetchWithAuth(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmationText }),
        });
        const data = (await response.json().catch(() => ({}))) as
          | Partial<AdminDeleteUserResponse>
          | Record<string, unknown>;
        if (!response.ok) {
          const errorMessage =
            typeof (data as { error?: unknown }).error === "string"
              ? (data as { error: string }).error
              : "User deletion failed.";
          throw new Error(errorMessage);
        }

        if (selectedUserId === userId) {
          setSelectedUserId("");
          setAdjustment("");
          setAdjustResult(null);
          setCreditLedgerRows([]);
          setCreditLedgerError(null);
          setCreditLedgerLoaded(false);
        }

        setDeleteResult("User deleted permanently.");
        await loadUsers();
        return true;
      } catch (error) {
        setDeleteResult(error instanceof Error ? error.message : "User deletion failed.");
        return false;
      } finally {
        setDeleteSubmitting(false);
      }
    },
    [loadUsers, selectedUserId]
  );

  const clearDeleteResult = React.useCallback(() => {
    setDeleteResult(null);
  }, []);

  const applyAdjustmentPreset = React.useCallback((delta: number) => {
    setAdjustment((current) => {
      const parsed = parseAdjustmentInput(current);
      const base = parsed ?? 0;
      return String(base + delta);
    });
  }, []);

  const handleUserSearchChange = React.useCallback((value: string) => {
    setUserSearch(value);
    setUsersPage(1);
  }, []);

  const handlePreviousUsersPage = React.useCallback(() => {
    setUsersPage((value) => Math.max(1, value - 1));
  }, []);

  const handleNextUsersPage = React.useCallback(() => {
    setUsersPage((value) => value + 1);
  }, []);

  const handleAdjustmentChange = React.useCallback((value: string) => {
    setAdjustment(sanitizeSignedIntegerInput(value));
  }, []);

  const handleInternalCompPlanChange = React.useCallback((value: string) => {
    setInternalCompPlan(value);
  }, []);

  const handleInternalCompReasonChange = React.useCallback((value: string) => {
    setInternalCompReason(value);
  }, []);

  const handleAllowStripeTakeoverChange = React.useCallback((value: boolean) => {
    setAllowStripeTakeover(value);
  }, []);

  const usersResultStart =
    usersPagination.totalCount === 0 ? 0 : (usersPagination.page - 1) * usersPagination.perPage + 1;
  const usersResultEnd = Math.min(
    usersPagination.page * usersPagination.perPage,
    usersPagination.totalCount
  );

  return {
    userSearch,
    usersPagination,
    userSearchLimited,
    users,
    usersLoading,
    usersError,
    selectedUserId,
    adjustment,
    adjustSubmitting,
    adjustResult,
    internalCompPlan,
    internalCompReason,
    allowStripeTakeover,
    billingOverrideSubmitting,
    billingOverrideResult,
    deleteSubmitting,
    deleteResult,
    creditLedgerRows,
    creditLedgerLoading,
    creditLedgerError,
    creditLedgerLoaded,
    billingDiagnostics,
    billingDiagnosticsLoading,
    billingDiagnosticsError,
    billingDiagnosticsLoaded,
    usersResultStart,
    usersResultEnd,
    setSelectedUserId,
    loadUsers,
    loadCreditLedger,
    loadBillingDiagnostics,
    handleUserSearchChange,
    handlePreviousUsersPage,
    handleNextUsersPage,
    handleAdjustmentChange,
    handleInternalCompPlanChange,
    handleInternalCompReasonChange,
    handleAllowStripeTakeoverChange,
    applyAdjustmentPreset,
    handleCreditAdjust,
    handleGrantInternalComp,
    handleRevokeInternalComp,
    handleDeleteUser,
    clearDeleteResult,
  };
};
