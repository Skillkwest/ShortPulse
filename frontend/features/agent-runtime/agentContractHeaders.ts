import type { NextApiResponse } from "next";

export const AGENT_CONTRACT_VERSION = "1";

export const setAgentContractVersionHeader = (res: NextApiResponse): void => {
  res.setHeader("Agent-Contract-Version", AGENT_CONTRACT_VERSION);
};
