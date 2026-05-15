#!/usr/bin/env node
/**
 * Purpose: compute D-Bug weighted checkpoint scores from the canonical scorecard
 * categories so report authors do not hand-calculate overall scores.
 */

const WEIGHTS = {
  scope: 20,
  evidence: 20,
  validation: 20,
  stop: 15,
  communication: 15,
  learning: 10,
};

const BAND_RULES = [
  { min: 9.0, label: "excellent" },
  { min: 8.0, label: "healthy" },
  { min: 7.0, label: "acceptable but should improve" },
  { min: 6.0, label: "warning" },
  { min: 0.0, label: "poor, intervention needed" },
];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function parseScore(value, label) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 1 || score > 10) {
    throw new Error(`${label} must be a number between 1 and 10.`);
  }
  return score;
}

function getBand(overall) {
  const match = BAND_RULES.find((rule) => overall >= rule.min);
  return match ? match.label : "unknown";
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(
      [
        "Usage:",
        "  node scripts/d_bug_scorecard.mjs \\",
        "    --scope 8 --evidence 9 --validation 7 \\",
        "    --stop 8 --communication 8 --learning 9",
        "",
        "Optional:",
        '  --override yes --override-reason "..."',
      ].join("\n"),
    );
    return;
  }

  const scores = {
    scope: parseScore(args.scope, "scope"),
    evidence: parseScore(args.evidence, "evidence"),
    validation: parseScore(args.validation, "validation"),
    stop: parseScore(args.stop, "stop"),
    communication: parseScore(args.communication, "communication"),
    learning: parseScore(args.learning, "learning"),
  };

  const weightedTotal =
    scores.scope * WEIGHTS.scope +
    scores.evidence * WEIGHTS.evidence +
    scores.validation * WEIGHTS.validation +
    scores.stop * WEIGHTS.stop +
    scores.communication * WEIGHTS.communication +
    scores.learning * WEIGHTS.learning;

  const overall = Math.round((weightedTotal / 100) * 10) / 10;
  const overrideTriggered =
    String(args.override || "no").toLowerCase() === "yes";

  const output = {
    scores,
    weights: WEIGHTS,
    weightedOverall: overall,
    scoreBand: getBand(overall),
    criticalFailureOverrideTriggered: overrideTriggered,
    overrideReason: overrideTriggered
      ? String(args["override-reason"] || "")
      : "",
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
