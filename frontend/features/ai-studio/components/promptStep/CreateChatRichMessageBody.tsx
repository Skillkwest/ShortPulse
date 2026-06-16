/**
 * Shared rich-text renderer for Create-panel chat messages.
 * Preserves readable structure without rewriting the message meaning.
 */
import React from "react";

type CreateChatRichMessageBlock =
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

type CreateChatRichMessageFormatMode = "basic" | "guided" | "standard_rich";

type CreateChatRichMessageBodyProps = {
  content: string;
  formatMode?: CreateChatRichMessageFormatMode;
  tone?: "assistant" | "user";
  linkifyUrls?: boolean;
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
const DOMAIN_URL_PATTERN =
  /(?:https?:\/\/[^\s<>"'`]+|(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\/[^\s<>"'`]*)?)/gi;
const MARKDOWN_LINK_PATTERN =
  /\[([^\]\n]+)\]((?:\((?:https?:\/\/[^\s)]+|(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\/[^\s)]*)?)\)))/gi;
const TRAILING_URL_PUNCTUATION_PATTERN = /[),.!?;:]+$/;

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
  return remainder.length ? remainder : value;
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

const parseListBlock = (lines: string[]): CreateChatRichMessageBlock | null => {
  if (!lines.length) return null;

  if (lines.every((line) => ORDERED_ITEM_PATTERN.test(line) || BULLET_ITEM_PATTERN.test(line))) {
    return {
      kind: "list",
      intro: null,
      items: lines.map(stripListPrefix),
      ordered: ORDERED_ITEM_PATTERN.test(lines[0] ?? ""),
    };
  }

  const firstListLineIndex = lines.findIndex(
    (line) => ORDERED_ITEM_PATTERN.test(line) || BULLET_ITEM_PATTERN.test(line)
  );
  if (firstListLineIndex > 0) {
    const intro = lines.slice(0, firstListLineIndex).join("\n").trim();
    const listLines = lines.slice(firstListLineIndex);
    if (
      intro.length > 0 &&
      listLines.length > 0 &&
      listLines.every((line) => ORDERED_ITEM_PATTERN.test(line) || BULLET_ITEM_PATTERN.test(line))
    ) {
      return {
        kind: "list",
        intro,
        items: listLines.map(stripListPrefix),
        ordered: ORDERED_ITEM_PATTERN.test(listLines[0] ?? ""),
      };
    }
  }

  return null;
};

const extractTrailingSectionLabel = (
  value: string
): { body: string | null; label: string } | null => {
  const normalized = value.trim();
  if (!normalized.length || QUESTION_LINE_PATTERN.test(normalized) || !normalized.endsWith(":")) {
    return null;
  }

  const trailingLabelMatch = normalized.match(/^(.*[.!?])\s+([A-Za-z][A-Za-z0-9'’/&() -]{0,40}):$/);
  if (trailingLabelMatch) {
    const body = trailingLabelMatch[1]?.trim() ?? "";
    const label = trailingLabelMatch[2]?.trim() ?? "";
    if (!body.length || !label.length) return null;

    return {
      body,
      label,
    };
  }

  if (!normalized.includes("\n")) {
    const standaloneLabel = normalized.replace(/:\s*$/, "").trim();
    if (standaloneLabel.length > 0 && standaloneLabel.length <= 60) {
      return { body: null, label: standaloneLabel };
    }
  }

  return null;
};

const isSafeHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const normalizeStandardLinkHref = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return isSafeHttpUrl(href) ? href : null;
};

const renderStandardLink = ({ href, label, key }: { href: string; label: string; key: string }) => (
  <a
    key={key}
    className="agent-message-rich-link"
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(event) => {
      event.stopPropagation();
    }}
  >
    {label}
  </a>
);

const renderInlineEmphasisText = (value: string, keyPrefix: string): React.ReactNode[] => {
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
    if (
      (token.startsWith("**") && token.endsWith("**")) ||
      (token.startsWith("__") && token.endsWith("__"))
    ) {
      nodes.push(
        <strong
          key={`${keyPrefix}-strong-${index}-${token}`}
          className="agent-message-rich-inline-strong"
        >
          {token.slice(2, -2)}
        </strong>
      );
    } else if (
      (token.startsWith("*") && token.endsWith("*")) ||
      (token.startsWith("_") && token.endsWith("_"))
    ) {
      nodes.push(
        <em
          key={`${keyPrefix}-em-${index}-${token}`}
          className="agent-message-rich-inline-emphasis"
        >
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

const renderBareUrlText = (value: string, keyPrefix: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(DOMAIN_URL_PATTERN)) {
    const index = match.index ?? 0;
    const token = match[0] ?? "";
    const trimmedHref = token.replace(TRAILING_URL_PUNCTUATION_PATTERN, "");
    const trailingText = token.slice(trimmedHref.length);
    const precedingCharacter = index > 0 ? value[index - 1] : "";

    if (index > lastIndex) {
      nodes.push(...renderInlineEmphasisText(value.slice(lastIndex, index), `${keyPrefix}-pre`));
    }

    const href = precedingCharacter === "@" ? null : normalizeStandardLinkHref(trimmedHref);
    if (href) {
      nodes.push(
        renderStandardLink({
          href,
          label: trimmedHref,
          key: `${keyPrefix}-url-${index}-${trimmedHref}`,
        })
      );
      if (trailingText) {
        nodes.push(trailingText);
      }
    } else {
      nodes.push(...renderInlineEmphasisText(token, `${keyPrefix}-raw-url-${index}`));
    }

    lastIndex = index + token.length;
  }

  if (lastIndex < value.length) {
    nodes.push(...renderInlineEmphasisText(value.slice(lastIndex), `${keyPrefix}-tail`));
  }

  return nodes;
};

const renderInlineText = (
  value: string,
  { linkifyUrls = false, keyPrefix = "inline" }: { linkifyUrls?: boolean; keyPrefix?: string } = {}
): React.ReactNode[] => {
  if (!linkifyUrls) {
    return renderInlineEmphasisText(value, keyPrefix);
  }

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(MARKDOWN_LINK_PATTERN)) {
    const index = match.index ?? 0;
    const rawToken = match[0] ?? "";
    const label = match[1]?.trim() ?? "";
    const rawHref = rawToken.match(/\((.+)\)$/)?.[1]?.trim() ?? "";

    if (index > lastIndex) {
      nodes.push(...renderBareUrlText(value.slice(lastIndex, index), `${keyPrefix}-pre-md`));
    }

    const href = normalizeStandardLinkHref(rawHref);
    if (label && href) {
      nodes.push(
        renderStandardLink({
          href,
          label,
          key: `${keyPrefix}-md-${index}-${href}`,
        })
      );
    } else {
      nodes.push(...renderBareUrlText(rawToken, `${keyPrefix}-raw-md-${index}`));
    }

    lastIndex = index + rawToken.length;
  }

  if (lastIndex < value.length) {
    nodes.push(...renderBareUrlText(value.slice(lastIndex), `${keyPrefix}-tail-md`));
  }

  return nodes;
};

const parseBasicBlocks = (value: string): CreateChatRichMessageBlock[] => {
  const blocks = splitParagraphBlocks(value);
  const parsedBlocks: CreateChatRichMessageBlock[] = [];

  for (const rawBlock of blocks) {
    const lines = rawBlock
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) continue;

    if (lines.length === 1) {
      const heading = isMarkdownHeading(lines[0] ?? "");
      if (heading) {
        parsedBlocks.push({
          kind: "heading",
          level: heading.level,
          text: heading.text,
        });
        continue;
      }
    }

    const listBlock = parseListBlock(lines);
    if (listBlock) {
      parsedBlocks.push(listBlock);
      continue;
    }

    parsedBlocks.push({
      kind: "paragraph",
      text: lines.join("\n"),
    });
  }

  return parsedBlocks;
};

const parseStandardRichBlocks = (value: string): CreateChatRichMessageBlock[] => {
  const blocks = splitParagraphBlocks(value);
  const parsedBlocks: CreateChatRichMessageBlock[] = [];

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const rawBlock = blocks[blockIndex] ?? "";
    const lines = rawBlock
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) continue;

    if (lines.length === 1 && isSeparator(lines[0] ?? "")) {
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
      const trailingLines = lines.slice(1);
      if (trailingLines.length > 0) {
        parsedBlocks.push(
          parseListBlock(trailingLines) ?? {
            kind: "paragraph",
            text: trailingLines.join("\n"),
          }
        );
      }
      continue;
    }

    const listBlock = parseListBlock(lines);
    if (listBlock) {
      parsedBlocks.push(listBlock);
      continue;
    }

    const nextBlockLines = (blocks[blockIndex + 1] ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const nextListBlock = nextBlockLines.length > 0 ? parseListBlock(nextBlockLines) : null;
    const sectionTransition = extractTrailingSectionLabel(lines.join("\n"));
    if (
      sectionTransition &&
      nextListBlock &&
      nextListBlock.kind === "list" &&
      !nextListBlock.intro
    ) {
      if (sectionTransition.body) {
        parsedBlocks.push({
          kind: "paragraph",
          text: sectionTransition.body,
        });
      }
      parsedBlocks.push({
        kind: "heading",
        level: 3,
        text: sectionTransition.label,
      });
      parsedBlocks.push(nextListBlock);
      blockIndex += 1;
      continue;
    }

    if (lines.length > 1 && !QUESTION_LINE_PATTERN.test(firstLine) && firstLine.endsWith(":")) {
      parsedBlocks.push({
        kind: "heading",
        level: 3,
        text: firstLine.replace(/:\s*$/, ""),
      });
      const trailingLines = lines.slice(1);
      parsedBlocks.push(
        parseListBlock(trailingLines) ?? {
          kind: "paragraph",
          text: trailingLines.join("\n"),
        }
      );
      continue;
    }

    const normalizedBlock = lines.join("\n");
    parsedBlocks.push({
      kind: "paragraph",
      text: normalizedBlock,
    });
  }

  return parsedBlocks;
};

const parseGuidedBlocks = (value: string): CreateChatRichMessageBlock[] => {
  const blocks = splitParagraphBlocks(value);
  const parsedBlocks: CreateChatRichMessageBlock[] = [];

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
      parsedBlocks.push({
        kind: "optionCard",
        number: optionCard.number,
        title: optionCard.title,
        description: lines
          .slice(1)
          .map((line) => line.trim())
          .filter(Boolean),
      });
      continue;
    }

    const listBlock = parseListBlock(lines);
    if (listBlock) {
      parsedBlocks.push(listBlock);
      continue;
    }

    if (lines.length === 1 && isStandaloneHeading(firstLine)) {
      parsedBlocks.push({
        kind: "heading",
        level: firstLine.endsWith(":") ? 3 : 2,
        text: firstLine.replace(/:\s*$/, ""),
      });
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

const parseCreateChatRichMessageBlocks = ({
  content,
  formatMode,
}: {
  content: string;
  formatMode: CreateChatRichMessageFormatMode;
}): CreateChatRichMessageBlock[] =>
  formatMode === "guided"
    ? parseGuidedBlocks(content)
    : formatMode === "standard_rich"
      ? parseStandardRichBlocks(content)
      : parseBasicBlocks(content);

/**
 * Renders readable Create-panel chat text while preserving the original meaning.
 */
export const CreateChatRichMessageBody = React.forwardRef<
  HTMLDivElement,
  CreateChatRichMessageBodyProps
>(function CreateChatRichMessageBody(
  { content, formatMode = "basic", tone = "assistant", linkifyUrls = false },
  ref
) {
  const blocks = React.useMemo(
    () => parseCreateChatRichMessageBlocks({ content, formatMode }),
    [content, formatMode]
  );

  return (
    <div
      ref={ref}
      className={`agent-message-rich-body agent-message-rich-body--${tone} agent-message-rich-body--${formatMode}`.trim()}
    >
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;

        if (block.kind === "heading") {
          return (
            <p
              key={key}
              className={`agent-message-rich-heading agent-message-rich-heading--level-${block.level}`.trim()}
            >
              {renderInlineText(block.text, { linkifyUrls, keyPrefix: key })}
            </p>
          );
        }

        if (block.kind === "paragraph") {
          return (
            <p key={key} className="agent-message-rich-paragraph">
              {renderInlineText(block.text, { linkifyUrls, keyPrefix: key })}
            </p>
          );
        }

        if (block.kind === "hint") {
          return (
            <p key={key} className="agent-message-rich-hint">
              {renderInlineText(block.text, { linkifyUrls, keyPrefix: key })}
            </p>
          );
        }

        if (block.kind === "replyChoices") {
          return (
            <div key={key} className="agent-message-rich-reply-block">
              <p className="agent-message-rich-reply-intro">
                {renderInlineText(block.intro, { linkifyUrls, keyPrefix: `${key}-intro` })}
              </p>
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
                {block.number} — {renderInlineText(block.title, { linkifyUrls, keyPrefix: key })}
              </p>
              {block.description.length ? (
                <p className="agent-message-rich-option-description">
                  {renderInlineText(block.description.join("\n"), {
                    linkifyUrls,
                    keyPrefix: `${key}-description`,
                  })}
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
              <p className="agent-message-rich-paragraph">
                {renderInlineText(block.intro, { linkifyUrls, keyPrefix: `${key}-intro` })}
              </p>
            ) : null}
            {block.ordered ? (
              <ol className="agent-message-rich-list agent-message-rich-list--ordered">
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`}>
                    <span>
                      {renderInlineText(item, { linkifyUrls, keyPrefix: `${key}-${itemIndex}` })}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <ul className="agent-message-rich-list agent-message-rich-list--unordered">
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-${itemIndex}`}>
                    <span>
                      {renderInlineText(item, { linkifyUrls, keyPrefix: `${key}-${itemIndex}` })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
});
