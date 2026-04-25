/**
 * Pulse-guided assistant message renderer.
 * Converts plain-text workflow replies into readable paragraphs, labels, and
 * numbered choice lists without affecting standard-mode chat rendering.
 */
import React from "react";

type PulseGuidedMessageBlock =
  | {
      kind: "label";
      text: string;
    }
  | {
      kind: "lead";
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
      kind: "list";
      intro: string | null;
      items: string[];
      ordered: boolean;
    };

const LABEL_LINE_PATTERN =
  /^(?:[A-Z][A-Z\s/&-]{2,}|Step\s+\d+(?:\s*[-:]\s*.+)?|Current\s+step|Next\s+step|Tip|Options?)$/i;
const ORDERED_ITEM_PATTERN = /^\s*\d+[.)]\s+/;
const BULLET_ITEM_PATTERN = /^\s*[-*•]\s+/;
const HINT_LINE_PATTERN =
  /^(?:Reply with|Type your own|Type one|Choose one|Pick one|You can also|If none fit|If you want)/i;

const normalizeText = (value: string): string =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();

const splitInlineOrderedList = (
  value: string
): { intro: string | null; items: string[] } | null => {
  const normalized = normalizeText(value);
  if (!normalized.length) return null;
  const matches = [...normalized.matchAll(/\d+[.)]\s+/g)];
  if (matches.length < 2) return null;

  const firstMatchIndex = matches[0]?.index ?? -1;
  if (firstMatchIndex < 0) return null;

  const intro = normalized.slice(0, firstMatchIndex).trim() || null;
  const items = matches
    .map((match, index) => {
      const itemStart = match.index ?? 0;
      const contentStart = itemStart + match[0].length;
      const itemEnd = matches[index + 1]?.index ?? normalized.length;
      return normalized.slice(contentStart, itemEnd).trim();
    })
    .filter((item) => item.length > 0);

  return items.length >= 2 ? { intro, items } : null;
};

const stripListPrefix = (value: string): string =>
  value.replace(ORDERED_ITEM_PATTERN, "").replace(BULLET_ITEM_PATTERN, "").trim();

const isLabelLine = (value: string): boolean => {
  const normalized = value.trim();
  if (!normalized.length) return false;
  if (normalized.length > 52) return false;
  return LABEL_LINE_PATTERN.test(normalized);
};

const isLeadParagraph = (value: string): boolean => {
  const normalized = normalizeText(value);
  if (!normalized.length || normalized.length > 220) return false;
  return normalized.endsWith("?");
};

const isHintParagraph = (value: string): boolean => {
  const normalized = normalizeText(value);
  if (!normalized.length || normalized.length > 180) return false;
  return HINT_LINE_PATTERN.test(normalized);
};

const parseSingleBlock = (value: string): PulseGuidedMessageBlock[] => {
  const normalized = normalizeText(value);
  if (!normalized.length) return [];

  const inlineList = splitInlineOrderedList(normalized);
  if (inlineList) {
    return [
      {
        kind: "list",
        intro: inlineList.intro,
        items: inlineList.items,
        ordered: true,
      },
    ];
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (!lines.length) return [];

  if (lines.length > 1 && isLabelLine(lines[0])) {
    return [{ kind: "label", text: lines[0] }, ...parseSingleBlock(lines.slice(1).join("\n"))];
  }

  if (lines.every((line) => ORDERED_ITEM_PATTERN.test(line))) {
    return [
      {
        kind: "list",
        intro: null,
        items: lines.map(stripListPrefix),
        ordered: true,
      },
    ];
  }

  if (lines.every((line) => BULLET_ITEM_PATTERN.test(line))) {
    return [
      {
        kind: "list",
        intro: null,
        items: lines.map(stripListPrefix),
        ordered: false,
      },
    ];
  }

  if (isHintParagraph(normalized)) {
    return [{ kind: "hint", text: normalized }];
  }

  if (isLeadParagraph(normalized)) {
    return [{ kind: "lead", text: normalized }];
  }

  return [{ kind: "paragraph", text: normalized }];
};

const parsePulseGuidedMessageBlocks = (value: string): PulseGuidedMessageBlock[] =>
  normalizeText(value)
    .split(/\n{2,}/)
    .flatMap((block) => parseSingleBlock(block));

/**
 * Renders Pulse workflow replies as readable instructional text.
 */
export const PulseGuidedMessageBody = React.forwardRef<HTMLDivElement, { content: string }>(
  function PulseGuidedMessageBody({ content }, ref) {
    const blocks = React.useMemo(() => parsePulseGuidedMessageBlocks(content), [content]);

    return (
      <div ref={ref} className="agent-message-rich-body agent-message-rich-body--pulse">
        {blocks.map((block, index) => {
          const key = `${block.kind}-${index}`;
          if (block.kind === "label") {
            return (
              <p key={key} className="agent-message-rich-label tiny">
                {block.text}
              </p>
            );
          }

          if (block.kind === "lead") {
            return (
              <p key={key} className="agent-message-rich-lead tiny">
                {block.text}
              </p>
            );
          }

          if (block.kind === "list") {
            const ListTag = block.ordered ? "ol" : "ul";
            return (
              <div key={key} className="agent-message-rich-list-block">
                {block.intro ? (
                  <p className="agent-message-rich-paragraph tiny">{block.intro}</p>
                ) : null}
                <ListTag
                  className={`agent-message-rich-list tiny ${
                    block.ordered
                      ? "agent-message-rich-list--ordered"
                      : "agent-message-rich-list--unordered"
                  }`.trim()}
                >
                  {block.items.map((item, itemIndex) => (
                    <li key={`${key}-${itemIndex}`}>
                      <span>{item}</span>
                    </li>
                  ))}
                </ListTag>
              </div>
            );
          }

          if (block.kind === "hint") {
            return (
              <p key={key} className="agent-message-rich-hint tiny">
                {block.text}
              </p>
            );
          }

          return (
            <p key={key} className="agent-message-rich-paragraph tiny">
              {block.text}
            </p>
          );
        })}
      </div>
    );
  }
);
