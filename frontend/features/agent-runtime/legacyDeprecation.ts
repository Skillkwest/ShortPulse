import type { NextApiResponse } from "next";

export const AGENT_LEGACY_DEPRECATION_SUNSET = "Sun, 26 Apr 2026 00:00:00 GMT";

const DEFAULT_DEPRECATION_DOC_URL = "https://docs.shortpulse.app/agent-route-migration";
const deprecationDocUrl =
  process.env.STUDIO_AGENT_DEPRECATION_DOC_URL || DEFAULT_DEPRECATION_DOC_URL;

export const applyAgentLegacyDeprecationHeaders = (res: NextApiResponse): void => {
  res.setHeader("Deprecation", "true");
  res.setHeader("Sunset", AGENT_LEGACY_DEPRECATION_SUNSET);
  res.setHeader("Link", `<${deprecationDocUrl}>; rel="deprecation"`);
};
