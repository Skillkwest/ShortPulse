/**
 * Typed loader and assertions for the shared Safe Completion evaluation corpus.
 * Production runtime must not import this test-only module.
 */
import corpusJson from "../fixtures/safeCompletionCases.json";

export type SafeCompletionPolicyClass = "allow" | "transform" | "refuse";
export type SafeCompletionTerminalOutcome = "success_message" | "success_prompt" | "refusal_safety";

export type SafeCompletionCase = {
  id: string;
  policyClass: SafeCompletionPolicyClass;
  safetyCategory: string;
  input: string;
  expected: {
    providerCallAllowed: boolean;
    recoveryAllowed: boolean;
    mustPreserve: string[];
    mustExclude: string[];
    mustNotUseMeta: boolean;
    terminalOutcome: SafeCompletionTerminalOutcome;
    maxRecoveryCount: 0 | 1;
  };
  safeRepairFixture?: string;
  unsafeRepairFixture?: string;
};

const POLICY_CLASSES = new Set<SafeCompletionPolicyClass>(["allow", "transform", "refuse"]);
const TERMINAL_OUTCOMES = new Set<SafeCompletionTerminalOutcome>([
  "success_message",
  "success_prompt",
  "refusal_safety",
]);

const validateCorpus = (): { forbiddenMetaPatterns: string[]; cases: SafeCompletionCase[] } => {
  if (corpusJson.schemaVersion !== 1) throw new Error("Unsupported Safe Completion corpus schema");
  const ids = new Set<string>();
  for (const pattern of corpusJson.forbiddenMetaPatterns) new RegExp(pattern, "i");
  for (const entry of corpusJson.cases) {
    if (!entry.id || ids.has(entry.id))
      throw new Error(`Duplicate Safe Completion id: ${entry.id}`);
    ids.add(entry.id);
    if (!POLICY_CLASSES.has(entry.policyClass as SafeCompletionPolicyClass)) {
      throw new Error(`Invalid policy class: ${entry.id}`);
    }
    if (!TERMINAL_OUTCOMES.has(entry.expected.terminalOutcome as SafeCompletionTerminalOutcome)) {
      throw new Error(`Invalid terminal outcome: ${entry.id}`);
    }
    if (entry.expected.maxRecoveryCount !== 0 && entry.expected.maxRecoveryCount !== 1) {
      throw new Error(`Invalid recovery count: ${entry.id}`);
    }
    if (entry.policyClass === "refuse" && entry.expected.recoveryAllowed) {
      throw new Error(`Refusal case cannot allow recovery: ${entry.id}`);
    }
    for (const pattern of entry.expected.mustExclude) new RegExp(pattern, "i");
  }
  return corpusJson as { forbiddenMetaPatterns: string[]; cases: SafeCompletionCase[] };
};

export const SAFE_COMPLETION_CORPUS = validateCorpus();

export const assertSafeCompletionPreserves = (output: string, snippets: string[]): void => {
  const normalized = output.toLowerCase();
  for (const snippet of snippets) {
    if (!normalized.includes(snippet.toLowerCase())) {
      throw new Error(`Missing required Safe Completion concept: ${snippet}`);
    }
  }
};

export const assertSafeCompletionExcludes = (output: string, patterns: string[]): void => {
  for (const pattern of patterns) {
    if (new RegExp(pattern, "i").test(output)) {
      throw new Error(`Unsafe Safe Completion pattern remained: ${pattern}`);
    }
  }
};

export const assertNoSafeCompletionDeadEndMeta = (output: string): void => {
  for (const pattern of SAFE_COMPLETION_CORPUS.forbiddenMetaPatterns) {
    if (new RegExp(pattern, "i").test(output)) {
      throw new Error(`Safe Completion returned dead-end meta language: ${pattern}`);
    }
  }
};
