import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readSupabaseUserId } from "../../../lib/supabaseClient";

export type UserPreferenceSyncState = "loading" | "ready" | "saving" | "error";

type UseUserPreferenceSyncParams<TValue> = {
  enabled?: boolean;
  readLocalBeforeUserResolution?: boolean;
  defaultValue: TValue;
  normalizeValue: (value: TValue) => TValue;
  readLocal: (userId?: string | null) => TValue;
  writeLocal: (value: TValue, userId?: string | null) => void;
  loadRemote: (
    userId: string,
    localValue: TValue
  ) => Promise<{
    value: TValue;
    hasRemoteValue: boolean;
  }>;
  persistRemote: (userId: string, value: TValue) => Promise<void>;
  isMissingRemoteError: (error: unknown) => boolean;
  loadErrorMessage: string;
  saveErrorMessage: string;
  treatMissingPersistErrorAsDisableRemote?: boolean;
};

type UseUserPreferenceSyncResult<TValue> = {
  value: TValue;
  loading: boolean;
  error: string | null;
  syncState: UserPreferenceSyncState;
  latestValueRef: React.MutableRefObject<TValue>;
  setValue: (
    nextValue: TValue,
    options?: {
      storageUserId?: string | null;
      persistLocal?: boolean;
    }
  ) => void;
  persistValue: (nextValue: TValue) => Promise<boolean>;
};

const resolveErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const useUserPreferenceSync = <TValue>({
  enabled = true,
  readLocalBeforeUserResolution = false,
  defaultValue,
  normalizeValue,
  readLocal,
  writeLocal,
  loadRemote,
  persistRemote,
  isMissingRemoteError,
  loadErrorMessage,
  saveErrorMessage,
  treatMissingPersistErrorAsDisableRemote = false,
}: UseUserPreferenceSyncParams<TValue>): UseUserPreferenceSyncResult<TValue> => {
  const normalizedDefaultValue = useMemo(
    () => normalizeValue(defaultValue),
    [defaultValue, normalizeValue]
  );
  const [value, setValueState] = useState<TValue>(normalizedDefaultValue);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<UserPreferenceSyncState>("loading");
  const latestValueRef = useRef<TValue>(normalizedDefaultValue);
  const userIdRef = useRef<string | null>(null);
  const remoteSyncEnabledRef = useRef<boolean>(true);
  const writeVersionRef = useRef<number>(0);
  const hasLocalOverrideRef = useRef<boolean>(false);

  const setValue = useCallback(
    (
      nextValue: TValue,
      options?: {
        storageUserId?: string | null;
        persistLocal?: boolean;
      }
    ) => {
      const normalizedValue = normalizeValue(nextValue);
      latestValueRef.current = normalizedValue;
      setValueState(normalizedValue);
      if (options?.persistLocal !== false) {
        writeLocal(normalizedValue, options?.storageUserId ?? userIdRef.current);
      }
    },
    [normalizeValue, writeLocal]
  );

  useEffect(() => {
    let active = true;
    if (!enabled) {
      remoteSyncEnabledRef.current = true;
      hasLocalOverrideRef.current = false;
      latestValueRef.current = normalizedDefaultValue;
      setValueState(normalizedDefaultValue);
      setLoading(false);
      setError(null);
      setSyncState("ready");
      userIdRef.current = null;
      return () => {
        active = false;
      };
    }

    remoteSyncEnabledRef.current = true;
    hasLocalOverrideRef.current = false;
    userIdRef.current = null;
    setLoading(true);
    setSyncState("loading");
    if (readLocalBeforeUserResolution) {
      setValue(readLocal(), { persistLocal: false });
    }

    (async () => {
      try {
        const resolvedUserId = await readSupabaseUserId();
        if (!resolvedUserId) {
          if (!active) return;
          userIdRef.current = null;
          if (!readLocalBeforeUserResolution) {
            setValue(readLocal(), { persistLocal: false });
          }
          setError(null);
          setSyncState("ready");
          return;
        }
        if (!active) return;
        userIdRef.current = resolvedUserId;
        const localValue = readLocal(resolvedUserId);
        setValue(localValue, {
          storageUserId: resolvedUserId,
          persistLocal: false,
        });

        const remoteValue = await loadRemote(resolvedUserId, localValue);
        if (!active) return;
        if (!hasLocalOverrideRef.current && remoteValue.hasRemoteValue) {
          setValue(remoteValue.value, {
            storageUserId: resolvedUserId,
            persistLocal: false,
          });
        }
        setError(null);
        setSyncState("ready");
      } catch (err) {
        if (!active) return;
        if (isMissingRemoteError(err)) {
          remoteSyncEnabledRef.current = false;
          setError(null);
          setSyncState("ready");
          return;
        }
        setError(resolveErrorMessage(err, loadErrorMessage));
        setSyncState("error");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    enabled,
    isMissingRemoteError,
    loadErrorMessage,
    loadRemote,
    normalizedDefaultValue,
    readLocalBeforeUserResolution,
    readLocal,
    setValue,
  ]);

  const persistValue = useCallback(
    async (nextValue: TValue) => {
      if (!enabled) return false;
      const requestVersion = writeVersionRef.current + 1;
      writeVersionRef.current = requestVersion;
      hasLocalOverrideRef.current = true;

      const normalizedNextValue = normalizeValue(nextValue);
      const previousValue = latestValueRef.current;
      setValue(normalizedNextValue, { persistLocal: true });
      setSyncState("saving");
      setError(null);

      const activeUserId = userIdRef.current;
      if (!activeUserId || !remoteSyncEnabledRef.current) {
        if (requestVersion === writeVersionRef.current) {
          setSyncState("ready");
        }
        return true;
      }

      try {
        await persistRemote(activeUserId, normalizedNextValue);
        if (requestVersion !== writeVersionRef.current) return true;
        setError(null);
        setSyncState("ready");
        return true;
      } catch (err) {
        if (requestVersion !== writeVersionRef.current) return false;
        if (treatMissingPersistErrorAsDisableRemote && isMissingRemoteError(err)) {
          remoteSyncEnabledRef.current = false;
          setError(null);
          setSyncState("ready");
          return true;
        }
        setValue(previousValue, { persistLocal: true });
        setError(resolveErrorMessage(err, saveErrorMessage));
        setSyncState("error");
        return false;
      }
    },
    [
      enabled,
      isMissingRemoteError,
      normalizeValue,
      persistRemote,
      saveErrorMessage,
      setValue,
      treatMissingPersistErrorAsDisableRemote,
    ]
  );

  return {
    value,
    loading,
    error,
    syncState,
    latestValueRef,
    setValue,
    persistValue,
  };
};
