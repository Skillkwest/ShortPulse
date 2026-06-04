/**
 * Component-local presentation primitives for the restored profile account page.
 * Keeps the account page readable when the older profile stylesheet is stale or absent.
 */
import type { CSSProperties } from "react";

const colors = {
  page: "#0b0f14",
  panel: "rgba(23, 27, 33, 0.94)",
  panelSoft: "rgba(18, 22, 28, 0.86)",
  card: "rgba(27, 31, 38, 0.96)",
  cardLift: "rgba(32, 37, 45, 0.98)",
  border: "rgba(210, 219, 232, 0.14)",
  borderStrong: "rgba(95, 205, 226, 0.38)",
  text: "#eef5f8",
  muted: "rgba(222, 229, 238, 0.72)",
  faint: "rgba(222, 229, 238, 0.52)",
  cyan: "#58c9df",
  teal: "#25a9bf",
  amber: "#f4b84f",
  danger: "#ff9f9f",
  success: "#7df0cb",
};

const shadow = "0 18px 48px rgba(0, 0, 0, 0.34)";

export const textStyles = {
  eyebrow: {
    margin: 0,
    color: colors.faint,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.08em",
    lineHeight: 1.2,
    textTransform: "uppercase",
  },
  h1: {
    margin: "8px 0 0",
    color: colors.text,
    fontSize: 34,
    fontWeight: 850,
    lineHeight: 1.05,
    letterSpacing: 0,
  },
  h2: {
    margin: 0,
    color: colors.text,
    fontSize: 22,
    fontWeight: 820,
    lineHeight: 1.1,
    letterSpacing: 0,
  },
  h3: {
    margin: 0,
    color: colors.text,
    fontSize: 20,
    fontWeight: 820,
    lineHeight: 1.15,
    letterSpacing: 0,
  },
  body: {
    margin: "8px 0 0",
    color: colors.muted,
    fontSize: 16,
    lineHeight: 1.5,
  },
  helper: {
    margin: "6px 0 0",
    color: colors.muted,
    fontSize: 13,
    lineHeight: 1.45,
  },
  label: {
    display: "block",
    marginBottom: 8,
    color: colors.text,
    fontSize: 13,
    fontWeight: 750,
    lineHeight: 1.2,
  },
} satisfies Record<string, CSSProperties>;

export const shellStyles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    maxWidth: "none",
    margin: 0,
    padding: "24px",
    background:
      "radial-gradient(900px 520px at 12% 0%, rgba(37, 169, 191, 0.14), transparent 58%), radial-gradient(760px 480px at 100% 4%, rgba(244, 184, 79, 0.09), transparent 48%), #0b0f14",
  },
  workspace: {
    width: "min(1340px, 100%)",
    margin: "0 auto",
    display: "grid",
    gap: 18,
  },
  header: {
    padding: "26px 28px",
    borderRadius: 18,
    border: `1px solid ${colors.border}`,
    background: "rgba(18, 22, 28, 0.78)",
    boxShadow: shadow,
  },
  identity: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    minWidth: 0,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    border: `1px solid ${colors.borderStrong}`,
    background: "linear-gradient(145deg, rgba(37, 169, 191, 0.22), rgba(244, 184, 79, 0.12))",
    color: colors.text,
    fontSize: 18,
    fontWeight: 850,
    flex: "0 0 auto",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "244px minmax(0, 1fr)",
    gap: 18,
    alignItems: "start",
  },
  layoutCompact: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 16,
  },
  rail: {
    position: "sticky",
    top: 18,
    display: "grid",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    border: `1px solid ${colors.border}`,
    background: colors.panelSoft,
    boxShadow: "0 14px 36px rgba(0, 0, 0, 0.24)",
  },
  railCompact: {
    position: "static",
  },
  brand: {
    display: "flex",
    justifyContent: "center",
    padding: "2px 8px 8px",
  },
  brandLogo: {
    display: "block",
    width: "min(172px, 100%)",
    height: "auto",
    objectFit: "contain",
  },
  nav: {
    display: "grid",
    gap: 8,
  },
  navCompact: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(154px, 1fr))",
    gap: 8,
  },
  body: {
    display: "grid",
    gap: 16,
    minWidth: 0,
  },
} satisfies Record<string, CSSProperties>;

export const accountStyles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
    gap: 16,
    alignItems: "stretch",
  },
  panel: {
    minHeight: 260,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: 22,
    borderRadius: 16,
    border: `1px solid ${colors.border}`,
    background: colors.card,
    boxShadow: shadow,
  },
  panelWide: {
    gridColumn: "span 2",
  },
  panelHeader: {
    display: "grid",
    gap: 8,
  },
  fieldStack: {
    display: "grid",
    gap: 14,
  },
  field: {
    display: "grid",
    gap: 0,
  },
  input: {
    width: "100%",
    minHeight: 48,
    padding: "12px 14px",
    borderRadius: 10,
    border: `1px solid ${colors.border}`,
    background: "rgba(8, 12, 17, 0.92)",
    color: colors.text,
    fontSize: 15,
    lineHeight: 1.25,
    outline: "none",
    boxSizing: "border-box",
  },
  actions: {
    display: "flex",
    gap: 10,
    marginTop: "auto",
  },
  button: {
    minHeight: 46,
    width: "100%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "12px 15px",
    borderRadius: 10,
    border: `1px solid ${colors.borderStrong}`,
    background: "linear-gradient(135deg, rgba(88, 201, 223, 0.95), rgba(37, 169, 191, 0.92))",
    color: "#071014",
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.1,
    cursor: "pointer",
  },
  ghostButton: {
    minHeight: 46,
    width: "100%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "12px 15px",
    borderRadius: 10,
    border: `1px solid ${colors.border}`,
    background: "rgba(222, 229, 238, 0.06)",
    color: colors.text,
    fontSize: 14,
    fontWeight: 820,
    lineHeight: 1.1,
    cursor: "pointer",
    textDecoration: "none",
  },
  preference: {
    minHeight: 260,
    display: "grid",
    alignContent: "space-between",
    gap: 18,
    padding: 22,
    borderRadius: 16,
    border: `1px solid ${colors.border}`,
    background: colors.cardLift,
    boxShadow: shadow,
  },
  preferenceRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  preferenceCopy: {
    display: "grid",
    gap: 8,
    minWidth: 0,
  },
  switchButton: {
    width: 58,
    height: 32,
    flex: "0 0 auto",
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    padding: 3,
    display: "flex",
    alignItems: "center",
    background: "rgba(222, 229, 238, 0.1)",
    cursor: "pointer",
  },
  switchButtonActive: {
    justifyContent: "flex-end",
    borderColor: "rgba(244, 184, 79, 0.72)",
    background: "linear-gradient(135deg, rgba(244, 184, 79, 0.95), rgba(37, 169, 191, 0.72))",
  },
  switchDot: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: colors.text,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.28)",
  },
  status: {
    margin: 0,
    color: colors.cyan,
    fontSize: 13,
    lineHeight: 1.45,
  },
  statusError: {
    color: colors.danger,
  },
} satisfies Record<string, CSSProperties>;

export const noticeToneColor = {
  success: colors.success,
  info: colors.cyan,
  error: colors.danger,
} as const;

export function navItemStyle(isActive: boolean): CSSProperties {
  return {
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 11,
    border: `1px solid ${isActive ? colors.borderStrong : colors.border}`,
    background: isActive ? "rgba(24, 64, 76, 0.94)" : "rgba(8, 12, 17, 0.72)",
    color: isActive ? colors.text : colors.muted,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.1,
  };
}

export function navIconStyle(isActive: boolean): CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    flex: "0 0 auto",
    background: isActive ? "rgba(88, 201, 223, 0.18)" : "rgba(222, 229, 238, 0.06)",
    color: isActive ? colors.cyan : colors.muted,
  };
}
