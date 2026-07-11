/**
 * Planning backlog Markdown parser.
 *
 * Extracts top-level backlog bullets from docs/planning/backlog.md so the
 * admin Kanban board can mirror the canonical backlog without becoming the
 * source of truth.
 */

import crypto from "node:crypto";

export const DEFAULT_BACKLOG_SOURCE_PATH = "docs/planning/backlog.md";
export const BACKLOG_KANBAN_ID_PATTERN = /^spb-p[0-5]-\d{3}$/;

const PROGRAM_HEADING_PATTERN = /^##\s+(Program\s+([0-5]):\s+.+?)\s*$/;
const TOP_LEVEL_BULLET_PATTERN = /^-\s+(.+?)\s*$/;
const KANBAN_ID_COMMENT_PATTERN = /<!--\s*kanban:([a-z0-9-]+)\s*-->/i;
const SOURCE_SPLIT_PATTERN = /\s+Sources?:\s+/;
const MAX_TITLE_LENGTH = 140;
const MAX_DETAILS_LENGTH = 1000;

const normalizeWhitespace = (value) => value.replace(/\s+/g, " ").trim();

const truncate = (value, maxLength) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const createFingerprint = (program, text) =>
  crypto
    .createHash("sha256")
    .update(`${program}\n${normalizeWhitespace(text)}`)
    .digest("hex");

const createTitle = (text) => {
  const [withoutSources] = text.split(SOURCE_SPLIT_PATTERN);
  return truncate(
    normalizeWhitespace(withoutSources || text),
    MAX_TITLE_LENGTH,
  );
};

const createDetails = ({ program, sourcePath, lineNumber, sourceKey, text }) =>
  truncate(
    [
      `Program: ${program}`,
      `Source: ${sourcePath}:${lineNumber}`,
      `Backlog id: ${sourceKey}`,
      "",
      normalizeWhitespace(text),
    ].join("\n"),
    MAX_DETAILS_LENGTH,
  );

/**
 * Parses planning backlog Markdown into Kanban-sync candidates.
 *
 * @param {string} markdown Markdown source from docs/planning/backlog.md.
 * @param {{ sourcePath?: string }} options Parser options.
 * @returns {{
 *   items: Array<{
 *     sourceKey: string,
 *     title: string,
 *     details: string,
 *     sourcePath: string,
 *     sourceSection: string,
 *     sourceLine: number,
 *     sourceFingerprint: string,
 *     text: string
 *   }>,
 *   errors: string[]
 * }} Parsed items and parser errors.
 */
export function parsePlanningBacklogMarkdown(markdown, options = {}) {
  const sourcePath = options.sourcePath ?? DEFAULT_BACKLOG_SOURCE_PATH;
  const items = [];
  const errors = [];
  const seenKeys = new Set();
  let currentProgram = null;

  markdown.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const headingMatch = line.match(PROGRAM_HEADING_PATTERN);
    if (headingMatch) {
      currentProgram = headingMatch[1];
      return;
    }

    if (!currentProgram) return;
    const bulletMatch = line.match(TOP_LEVEL_BULLET_PATTERN);
    if (!bulletMatch) return;

    const rawText = bulletMatch[1];
    const idMatch = rawText.match(KANBAN_ID_COMMENT_PATTERN);
    if (!idMatch) {
      errors.push(`${sourcePath}:${lineNumber} missing kanban id comment`);
      return;
    }

    const sourceKey = idMatch[1].toLowerCase();
    if (!BACKLOG_KANBAN_ID_PATTERN.test(sourceKey)) {
      errors.push(`${sourcePath}:${lineNumber} invalid kanban id ${sourceKey}`);
      return;
    }
    if (seenKeys.has(sourceKey)) {
      errors.push(
        `${sourcePath}:${lineNumber} duplicate kanban id ${sourceKey}`,
      );
      return;
    }
    seenKeys.add(sourceKey);

    const text = normalizeWhitespace(
      rawText.replace(KANBAN_ID_COMMENT_PATTERN, ""),
    );
    if (!text) {
      errors.push(`${sourcePath}:${lineNumber} has an empty backlog item`);
      return;
    }

    items.push({
      sourceKey,
      title: createTitle(text),
      details: createDetails({
        program: currentProgram,
        sourcePath,
        lineNumber,
        sourceKey,
        text,
      }),
      sourcePath,
      sourceSection: currentProgram,
      sourceLine: lineNumber,
      sourceFingerprint: createFingerprint(currentProgram, text),
      text,
    });
  });

  return { items, errors };
}
