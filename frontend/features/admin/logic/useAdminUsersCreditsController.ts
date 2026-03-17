/**
 * Admin users and credits controller.
 * Owns overview-tab user search, selection, credit ledger loading, and manual adjustment flows.
 */
import React from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type { AdminCreditLedgerRow, AdminPagination, AdminUserRow } from "../types";

export const ADMIN_DASHBOARD_USERS_PER_PAGE = 50;
export const ADMIN_DASHBOARD_CREDIT_LEDGER_LIMIT = 20;
export const ADMIN_DASHBOARD_ADJUSTMENT_PRESETS = [100, 500, -100, -500] as const;
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
  creditLedgerRows: AdminCreditLedgerRow[];
  creditLedgerLoading: boolean;
  creditLedgerError: string | null;
  activeUsersCount: number;
  pendingCreditsCount: number;
  usersResultStart: number;
  usersResultEnd: number;
  setSelectedUserId: React.Dispatch<React.SetStateAction<string>>;
  loadUsers: () => Promise<void>;
  loadCreditLedger: () => Promise<void>;
  handleUserSearchChange: (value: string) => void;
  handlePreviousUsersPage: () => void;
  handleNextUsersPage: () => void;
  handleAdjustmentChange: (value: string) => void;
  applyAdjustmentPreset: (delta: number) => void;
  handleCreditAdjust: () => Promise<void>;
};

/**
 * Compose the admin users/credits overview surface behind a route-local controller boundary.
 */
export const useAdminUsersCreditsController = ({
  enabled,
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
  const [creditLedgerRows, setCreditLedgerRows] = React.useState<AdminCreditLedgerRow[]>([]);
  const [creditLedgerLoading, setCreditLedgerLoading] = React.useState(false);
  const [creditLedgerError, setCreditLedgerError] = React.useState<string | null>(null);

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
    } catch (error) {
      setCreditLedgerError(
        error instanceof Error ? error.message : "Failed to load credit transactions."
      );
      setCreditLedgerRows([]);
    } finally {
      setCreditLedgerLoading(false);
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
    if (!users.length) {
      if (selectedUserId) setSelectedUserId("");
      return;
    }
    const selectedStillExists = users.some((row) => row.id === selectedUserId);
    if (!selectedUserId || !selectedStillExists) {
      setSelectedUserId(users[0].id);
    }
  }, [selectedUserId, users]);

  React.useEffect(() => {
    if (!enabled) return;
    void loadCreditLedger();
  }, [enabled, loadCreditLedger]);

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

  const activeUsersCount = usersPagination.totalCount;
  const pendingCreditsCount = React.useMemo(
    () => users.filter((row) => row.spendableCredits <= 0).length,
    [users]
  );
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
    creditLedgerRows,
    creditLedgerLoading,
    creditLedgerError,
    activeUsersCount,
    pendingCreditsCount,
    usersResultStart,
    usersResultEnd,
    setSelectedUserId,
    loadUsers,
    loadCreditLedger,
    handleUserSearchChange,
    handlePreviousUsersPage,
    handleNextUsersPage,
    handleAdjustmentChange,
    applyAdjustmentPreset,
    handleCreditAdjust,
  };
};
