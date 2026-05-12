export const isPerfAuditRuntimeEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("perfAuditRuntime")?.trim() === "1";
};

const MAX_DEBUG_VALUE_LENGTH = 56;

const compactDebugValue = (value: string): string => {
  if (value.length <= MAX_DEBUG_VALUE_LENGTH) return value;
  return `${value.slice(0, 24)}...${value.slice(-24)}`;
};

export const formatPerfAuditDebugLine = (label: string, value: string | null | undefined): string =>
  `${label}:${value ? compactDebugValue(value) : "null"}`;
