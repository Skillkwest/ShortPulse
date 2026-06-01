#!/usr/bin/env node
/**
 * Gear Ball path-relation helpers.
 * Provides lightweight scoring so Gear Ball can spot likely sibling files and
 * late related tails without hand-scanning long worktree listings.
 */

import path from "node:path";

const GENERIC_PATH_TOKENS = new Set([
  "frontend",
  "docs",
  "scripts",
  "sql",
  "lib",
  "server",
  "client",
  "api",
  "components",
  "hooks",
  "logic",
  "controllers",
  "pages",
  "features",
  "tests",
  "test",
  "__tests__",
]);

export function normalizePath(value) {
  return String(value ?? "")
    .replaceAll(path.sep, "/")
    .replace(/^\.\/+/, "")
    .trim();
}

function splitCamelCase(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function pathTokens(filePath) {
  const normalized = normalizePath(filePath).toLowerCase();
  const rawParts = splitCamelCase(normalized)
    .split(/[^a-z0-9]+/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !GENERIC_PATH_TOKENS.has(part));
  return new Set(rawParts);
}

function baseStem(filePath) {
  const parsed = path.posix.parse(normalizePath(filePath));
  return parsed.name.toLowerCase();
}

function firstTwoSegments(filePath) {
  const parts = normalizePath(filePath).split("/");
  if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  return parts[0] ?? "";
}

function firstThreeSegments(filePath) {
  const parts = normalizePath(filePath).split("/");
  if (parts.length >= 3) return `${parts[0]}/${parts[1]}/${parts[2]}`;
  return firstTwoSegments(filePath);
}

function firstSegment(filePath) {
  return normalizePath(filePath).split("/")[0] ?? "";
}

function sharedDirectoryDepth(leftPath, rightPath) {
  const leftParts = path.posix.dirname(normalizePath(leftPath)).split("/");
  const rightParts = path.posix.dirname(normalizePath(rightPath)).split("/");
  let depth = 0;
  while (
    depth < leftParts.length &&
    depth < rightParts.length &&
    leftParts[depth] === rightParts[depth]
  ) {
    depth += 1;
  }
  return depth;
}

function sharedTokenCount(left, right) {
  let count = 0;
  for (const token of left) {
    if (right.has(token)) count += 1;
  }
  return count;
}

function isTestFile(filePath) {
  return /(?:^|\/)__tests__\/|(?:^|\/)[^/]+\.test\.[^/]+$/i.test(
    normalizePath(filePath),
  );
}

function isRouteDoc(filePath) {
  const normalized = normalizePath(filePath);
  return normalized === "README.md" || normalized === "docs/routes.md";
}

function isRouteLike(filePath) {
  return /frontend\/pages\/|frontend\/features\/dashboard\//.test(
    normalizePath(filePath),
  );
}

export function relationScore(seedPath, candidatePath) {
  const seed = normalizePath(seedPath);
  const candidate = normalizePath(candidatePath);
  if (!seed || !candidate || seed === candidate) return 0;

  let score = 0;
  const seedDir = path.posix.dirname(seed);
  const candidateDir = path.posix.dirname(candidate);

  if (seedDir === candidateDir) score += 7;
  score += Math.max(0, Math.min(sharedDirectoryDepth(seed, candidate) - 1, 3));
  if (firstThreeSegments(seed) === firstThreeSegments(candidate)) score += 3;
  else if (firstTwoSegments(seed) === firstTwoSegments(candidate)) score += 1;
  if (firstSegment(seed) === firstSegment(candidate)) score += 1;
  if (baseStem(seed) === baseStem(candidate)) score += 4;

  const tokenOverlap = Math.min(
    sharedTokenCount(pathTokens(seed), pathTokens(candidate)),
    4,
  );
  score += tokenOverlap;

  if (isTestFile(candidate) && tokenOverlap > 0) score += 3;
  if (isRouteLike(seed) && isRouteDoc(candidate)) score += 2;

  return score;
}

export function rankCandidates(seedFiles, candidateFiles) {
  const seeds = seedFiles.map(normalizePath).filter(Boolean);
  const candidates = candidateFiles.map(normalizePath).filter(Boolean);

  return candidates
    .map((candidate) => {
      let bestScore = 0;
      let bestSeed = null;
      for (const seed of seeds) {
        const score = relationScore(seed, candidate);
        if (score > bestScore) {
          bestScore = score;
          bestSeed = seed;
        }
      }
      return {
        candidate,
        score: bestScore,
        via: bestSeed,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.candidate.localeCompare(right.candidate),
    );
}
