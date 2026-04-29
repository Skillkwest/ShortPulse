/**
 * Pulse-guided assistant message renderer.
 * Converts workflow replies into polished rich text blocks without affecting
 * standard-mode chat rendering.
 */
import React from "react";

type PulseGuidedMessageBlock =
  | {
      kind: "heading";
      level: 1 | 2 | 3;
      text: string;
    }
  | {
      kind: "paragraph";
      text: string;
    }
  | {
      kind: "hint";
      text: string;
    }
  | {
      kind: "replyChoices";
      intro: string;
      choices: string[];
    }
  | {
      kind: "optionCard";
      number: string;
      title: string;
      description: string[];
    }
  | {
      kind: "list";
      intro: string | null;
      items: string[];
      ordered: boolean;
    }
  | {
      kind: "separator";
    };

const LABEL_LINE_PATTERN =
  /^(?:[A-Z][A-Z\s/&-]{2,}|Step\s+\d+|Current\s+step|Next\s+step|Tip|Options?)$/i;
const QUESTION_LINE_PATTERN = /.+\?$/;
const TITLE_CASE_LINE_PATTERN = /^(?:[A-Z][a-z0-9'’()/-]+(?:\s+[A-Z][a-z0-9'’()/-]+){0,7})$/;
const HEADING_PREFIX_PATTERN = /^#{1,3}\s+(.+)$/;
const WORKFLOW_LABEL_PREFIX_PATTERN = /^(?:current\s+step|next\s+step)\s*:?\s*/i;
const REPLY_WITH_PATTERN = /^reply\s+with\s*:?\s*$/i;
const OPTION_CARD_PATTERN = /^(\d+)\s*[—-]\s*(.+)$/;
const ORDERED_ITEM_PATTERN = /^\s*\d+[.)]\s+/;
const BULLET_ITEM_PATTERN = /^\s*[-*•]\s+/;
const HINT_LINE_PATTERN =
  /^(?:Reply with|Type your own|or type your own|Type one|Choose one|Pick one|You can also|If none fit|If you want)/i;
const SEPARATOR_PATTERN = /^(?:-{3,}|\*{3,}|_{3,})$/;

const normalizeText = (value: string): string =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();

const splitParagraphBlocks = (value: string): string[] =>
  normalizeText(value)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

const stripListPrefix = (value: string): string =>
  value.replace(ORDERED_ITEM_PATTERN, "").replace(BULLET_ITEM_PATTERN, "").trim();

const stripFusedWorkflowLabel = (value: string): string => {
  const match = value.match(/^Concept\s+(.+)$/i);
  if (!match) return value;
  const remainder = match[1]?.trim() ?? "";
  if (!remainder) return value;
  return remainder;
};

const stripWorkflowChrome = (value: string): string[] => {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(WORKFLOW_LABEL_PREFIX_PATTERN, "").trim())
    .map(stripFusedWorkflowLabel)
    .filter((line) => line.length > 0);

  while (lines.length > 1 && LABEL_LINE_PATTERN.test(lines[0] ?? "")) {
    lines.shift();
  }

  if (lines.length === 1 && LABEL_LINE_PATTERN.test(lines[0] ?? "")) {
    return [];
  }

  return lines;
};

const isMarkdownHeading = (value: string): { level: 1 | 2 | 3; text: string } | null => {
  const match = value.match(HEADING_PREFIX_PATTERN);
  if (!match) return null;
  const prefixLength = value.match(/^#{1,3}/)?.[0]?.length ?? 0;
  const level = Math.min(3, Math.max(1, prefixLength)) as 1 | 2 | 3;
  return {
    level,
    text: match[1]?.trim() ?? "",
  };
};

const isStandaloneHeading = (value: string): boolean => {
  const normalized = value.trim();
  if (!normalized.length || normalized.length > 90) return false;
  if (QUESTION_LINE_PATTERN.test(normalized)) return true;
  if (normalized.endsWith(":")) return true;
  if (LABEL_LINE_PATTERN.test(normalized)) return false;
  return TITLE_CASE_LINE_PATTERN.test(normalized);
};

const isHintParagraph = (value: string): boolean => {
  const normalized = normalizeText(value);
  if (!normalized.length || normalized.length > 180) return false;
  return HINT_LINE_PATTERN.test(normalized);
};

const isSeparator = (value: string): boolean => SEPARATOR_PATTERN.test(value.trim());

const splitReplyChoices = (value: string): string[] | null => {
  const normalized = normalizeText(value);
  if (!normalized.length) return null;
  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length < 2) return null;
  if (!tokens.every((token) => token === "..." || /^\d+$/.test(token))) return null;
  return tokens;
};

const parseOptionCard = (value: string): { number: string; title: string } | null => {
  const match = value.trim().match(OPTION_CARD_PATTERN);
  if (!match) return null;
  const number = match[1]?.trim() ?? "";
  const title = match[2]?.trim() ?? "";
  if (!number || !title) return null;
  return { number, title };
};

const renderInlineText = (value: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  const normalized = value.replace(/\r\n/g, "\n");
  const pattern = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g;
  let lastIndex = 0;

  for (const match of normalized.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(normalized.slice(lastIndex, index));
    }

    const token = match[0] ?? "";
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={`${index}-${token}`} className="agent-message-rich-inline-strong">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("__") && token.endsWith("__")) {
      nodes.push(
        <strong key={`${index}-${token}`} className="agent-message-rich-inline-strong">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(
        <em key={`${index}-${token}`} className="agent-message-rich-inline-emphasis">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("_") && token.endsWith("_")) {
      nodes.push(
        <em key={`${index}-${token}`} className="agent-message-rich-inline-emphasis">
          {token.slice(1, -1)}
        </em>
      );
    }

    lastIndex = index + token.length;
  }

  if (lastIndex < normalized.length) {
    nodes.push(normalized.slice(lastIndex));
  }

  return nodes;
};

const parsePulseGuidedMessageBlocks = (value: string): PulseGuidedMessageBlock[] => {
  const blocks = splitParagraphBlocks(value);
  const parsedBlocks: PulseGuidedMessageBlock[] = [];

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const rawBlock = blocks[blockIndex] ?? "";
    const lines = stripWorkflowChrome(rawBlock);
    if (!lines.length) continue;

    if (lines.length === 1 && isSeparator(lines[0] ?? "")) {
      parsedBlocks.push({ kind: "separator" });
      continue;
    }

    const firstLine = lines[0] ?? "";
    const heading = isMarkdownHeading(firstLine);
    if (heading) {
      parsedBlocks.push({
        kind: "heading",
        level: heading.level,
        text: heading.text,
      });
      continue;
    }

    if (REPLY_WITH_PATTERN.test(firstLine)) {
      const inlineReplyLine = lines[1] ?? "";
      const lookaheadReplyLine = splitReplyChoices(blocks[blockIndex + 1] ?? "");
      const replyChoices = splitReplyChoices(inlineReplyLine) ?? lookaheadReplyLine;
      if (replyChoices) {
        parsedBlocks.push({
          kind: "replyChoices",
          intro: firstLine.replace(/:?\s*$/, ":"),
          choices: replyChoices,
        });
        if (!splitReplyChoices(inlineReplyLine) && lookaheadReplyLine) {
          blockIndex += 1;
        }
        if (lines.length > 2) {
          const rest = lines.slice(2).join("\n").trim();
          if (rest.length) {
            parsedBlocks.push({
              kind: "paragraph",
              text: rest,
            });
          }
        }
        continue;
      }
      parsedBlocks.push({
        kind: "heading",
        level: 3,
        text: firstLine.replace(/:?\s*$/, ""),
      });
      if (lines.length > 1) {
        const rest = lines.slice(1).join("\n").trim();
        if (rest.length) {
          parsedBlocks.push({
            kind: "paragraph",
            text: rest,
          });
        }
      }
      continue;
    }

    const optionCard = parseOptionCard(firstLine);
    if (optionCard) {
      const description = lines
        .slice(1)
        .map((line) => line.trim())
        .filter(Boolean);
      parsedBlocks.push({
        kind: "optionCard",
        number: optionCard.number,
        title: optionCard.title,
        description,
      });
      continue;
    }

    if (lines.length === 1 && isStandaloneHeading(firstLine)) {
      parsedBlocks.push({
        kind: "heading",
        level: QUESTION_LINE_PATTERN.test(firstLine) ? 1 : 2,
        text: firstLine.replace(/:$/, ""),
      });
      continue;
    }

    if (lines.every((line) => ORDERED_ITEM_PATTERN.test(line))) {
      parsedBlocks.push({
        kind: "list",
        intro: null,
        items: lines.map(stripListPrefix),
        ordered: true,
      });
      continue;
    }

    if (lines.every((line) => BULLET_ITEM_PATTERN.test(line))) {
      parsedBlocks.push({
        kind: "list",
        intro: null,
        items: lines.map(stripListPrefix),
        ordered: false,
      });
      continue;
    }

    if (lines.length > 1 && lines[0] && isHintParagraph(lines[0])) {
      parsedBlocks.push({
        kind: "hint",
        text: lines[0],
      });
      const rest = lines.slice(1).join("\n").trim();
      if (rest.length) {
        parsedBlocks.push({
          kind: "paragraph",
          text: rest,
        });
      }
      continue;
    }

    if (isHintParagraph(lines.join("\n"))) {
      parsedBlocks.push({
        kind: "hint",
        text: lines.join("\n"),
      });
      continue;
    }

    parsedBlocks.push({
      kind: "paragraph",
      text: lines.join("\n"),
    });
  }

  return parsedBlocks;
};

/**
 * Renders Pulse workflow replies as polished instructional text.
 */
export const PulseGuidedMessageBody = React.forwardRef<HTMLDivElement, { content: string }>(
  function PulseGuidedMessageBody({ content }, ref) {
    const blocks = React.useMemo(() => parsePulseGuidedMessageBlocks(content), [content]);

    return (
      <div ref={ref} className="agent-message-rich-body agent-message-rich-body--pulse">
        {blocks.map((block, index) => {
          const key = `${block.kind}-${index}`;

          if (block.kind === "heading") {
            return (
              <p
                key={key}
                className={`agent-message-rich-heading agent-message-rich-heading--level-${block.level}`.trim()}
              >
                {renderInlineText(block.text)}
              </p>
            );
          }

          if (block.kind === "paragraph") {
            return (
              <p key={key} className="agent-message-rich-paragraph">
                {renderInlineText(block.text)}
              </p>
            );
          }

          if (block.kind === "hint") {
            return (
              <p key={key} className="agent-message-rich-hint">
                {renderInlineText(block.text)}
              </p>
            );
          }

          if (block.kind === "replyChoices") {
            return (
              <div key={key} className="agent-message-rich-reply-block">
                <p className="agent-message-rich-reply-intro">{renderInlineText(block.intro)}</p>
                <div className="agent-message-rich-choice-row" aria-label={block.intro}>
                  {block.choices.map((choice, choiceIndex) => (
                    <span
                      key={`${key}-${choiceIndex}-${choice}`}
                      className="agent-message-rich-choice-chip"
                    >
                      {choice}
                    </span>
                  ))}
                </div>
              </div>
            );
          }

          if (block.kind === "optionCard") {
            return (
              <div key={key} className="agent-message-rich-option-card">
                <p className="agent-message-rich-option-title">
                  {block.number} — {renderInlineText(block.title)}
                </p>
                {block.description.length ? (
                  <p className="agent-message-rich-option-description">
                    {renderInlineText(block.description.join("\n"))}
                  </p>
                ) : null}
              </div>
            );
          }

          if (block.kind === "separator") {
            return <div key={key} className="agent-message-rich-separator" aria-hidden="true" />;
          }

          return (
            <div key={key} className="agent-message-rich-list-block">
              {block.intro ? (
                <p className="agent-message-rich-paragraph">{renderInlineText(block.intro)}</p>
              ) : null}
              <ul
                className={`agent-message-rich-list ${block.ordered ? "agent-message-rich-list--ordered" : "agent-message-rich-list--unordered"}`.trim()}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`}>
                    <span>{renderInlineText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    );
  }
);
