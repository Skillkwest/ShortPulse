import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { readChatModeFromStorage, writeChatModeToStorage } from "../../logic/chatModePreference";

type UseStandardCreateChatModeParams = {
  projectId?: string | null;
  projectRouteRequested?: boolean;
};

const resolveStateActionValue = <T>(value: SetStateAction<T>, current: T): T =>
  typeof value === "function" ? (value as (previousValue: T) => T)(current) : value;

const resolveInitialStandardChatMode = ({
  projectId = null,
  projectRouteRequested = false,
}: UseStandardCreateChatModeParams): boolean => {
  if (typeof window === "undefined") return true;
  if (projectRouteRequested || projectId) return true;
  return readChatModeFromStorage(window.localStorage);
};

/**
 * Standard Create owns the chat/raw-prompt toggle and its local preference.
 * Pulse Create should not read, write, or receive this preference.
 */
export const useStandardCreateChatMode = ({
  projectId = null,
  projectRouteRequested = false,
}: UseStandardCreateChatModeParams = {}) => {
  const [standardChatModeEnabled, setStandardChatModeEnabledState] = useState(() =>
    resolveInitialStandardChatMode({ projectId, projectRouteRequested })
  );
  const [defaultStandardChatModeEnabled] = useState(standardChatModeEnabled);

  const setStandardChatModeEnabled: Dispatch<SetStateAction<boolean>> = useCallback(
    (value) => {
      setStandardChatModeEnabledState((current) => {
        const nextValue = resolveStateActionValue(value, current);
        if (typeof window !== "undefined" && !projectRouteRequested && !projectId) {
          writeChatModeToStorage(nextValue, window.localStorage);
        }
        return nextValue;
      });
    },
    [projectId, projectRouteRequested]
  );

  return {
    standardChatModeEnabled,
    defaultStandardChatModeEnabled,
    setStandardChatModeEnabled,
  };
};
