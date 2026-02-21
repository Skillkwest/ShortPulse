import type { NextApiRequest } from "next";
import type { AuthenticatedApiUser } from "../../lib/server/api/auth";
import {
  executeLegacyPromptGeneration,
  type LegacyPromptGenerationResult,
} from "./legacyPromptGenerationService";
import {
  executeLegacyImageDescribe,
  type LegacyImageDescribeResult,
} from "./legacyImageDescribeService";

export type AgentRuntimeService = {
  generatePrompt(input: {
    req: NextApiRequest;
    user: AuthenticatedApiUser;
    prompt: unknown;
    routeLabel?: string;
  }): Promise<LegacyPromptGenerationResult>;
  describeImage(input: {
    req: NextApiRequest;
    user: AuthenticatedApiUser;
    imageUrl: unknown;
    routeLabel?: string;
  }): Promise<LegacyImageDescribeResult>;
};

export const agentRuntimeService: AgentRuntimeService = {
  generatePrompt(input) {
    return executeLegacyPromptGeneration(input);
  },
  describeImage(input) {
    return executeLegacyImageDescribe(input);
  },
};
