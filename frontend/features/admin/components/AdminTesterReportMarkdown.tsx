/**
 * Safe rich-text renderer for admin tester persona reports.
 */
import type { ReactNode } from "react";
import styles from "./AdminTesterReportMarkdown.module.css";

type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; text: string };

type AdminTesterReportMarkdownProps = {
  body: string;
};

const HEADING_PATTERN = /^(#{1,3})\s+(.+)$/;
const UNORDERED_ITEM_PATTERN = /^\s*[-*]\s+(.+)$/;
const ORDERED_ITEM_PATTERN = /^\s*\d+[.)]\s+(.+)$/;
const FENCE_PATTERN = /^\s*```/;
const INLINE_MARKDOWN_PATTERN =
  /(\[([^\]\n]+)\]\(([^)\s]+)\))|(`([^`\n]+)`)|(\*\*([^*\n]+)\*\*)|(\*([^*\n]+)\*)/g;

const normalizeReportBody = (body: string): string => body.replace(/\r\n/g, "\n").trim();

const parseMarkdownBlocks = (body: string): MarkdownBlock[] => {
  const lines = normalizeReportBody(body).split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let codeLines: string[] = [];
  let inCodeFence = false;

  const flushParagraph = () => {
    const text = paragraphLines
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ");
    if (text) {
      blocks.push({ type: "paragraph", text });
    }
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: "list", ordered: listOrdered, items: listItems });
    }
    listItems = [];
    listOrdered = false;
  };

  const flushCode = () => {
    if (codeLines.length > 0) {
      blocks.push({ type: "code", text: codeLines.join("\n") });
    }
    codeLines = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();

    if (FENCE_PATTERN.test(line)) {
      flushParagraph();
      flushList();
      if (inCodeFence) {
        flushCode();
        inCodeFence = false;
      } else {
        inCodeFence = true;
      }
      return;
    }

    if (inCodeFence) {
      codeLines.push(rawLine);
      return;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }

    const heading = line.match(HEADING_PATTERN);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: Math.min(3, heading[1]?.length ?? 1) as 1 | 2 | 3,
        text: heading[2]?.trim() ?? "",
      });
      return;
    }

    const orderedItem = line.match(ORDERED_ITEM_PATTERN);
    const unorderedItem = line.match(UNORDERED_ITEM_PATTERN);
    const nextItem = orderedItem?.[1] ?? unorderedItem?.[1];
    if (nextItem) {
      flushParagraph();
      const nextOrdered = Boolean(orderedItem);
      if (listItems.length > 0 && listOrdered !== nextOrdered) {
        flushList();
      }
      listOrdered = nextOrdered;
      listItems.push(nextItem.trim());
      return;
    }

    flushList();
    paragraphLines.push(line);
  });

  flushParagraph();
  flushList();
  flushCode();

  return blocks;
};

const isSafeHref = (href: string): boolean => /^(https?:|mailto:)/i.test(href);

const renderInlineMarkdown = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE_MARKDOWN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      nodes.push(text.slice(cursor, index));
    }

    if (match[2] && match[3]) {
      const href = match[3];
      nodes.push(
        isSafeHref(href) ? (
          <a key={`link-${index}`} href={href} target="_blank" rel="noreferrer">
            {match[2]}
          </a>
        ) : (
          <span key={`link-${index}`}>{match[2]}</span>
        )
      );
    } else if (match[5]) {
      nodes.push(<code key={`code-${index}`}>{match[5]}</code>);
    } else if (match[7]) {
      nodes.push(<strong key={`strong-${index}`}>{match[7]}</strong>);
    } else if (match[9]) {
      nodes.push(<em key={`em-${index}`}>{match[9]}</em>);
    }

    cursor = index + match[0].length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
};

/**
 * Renders tester-persona Markdown as compact rich text without injecting HTML.
 */
export function AdminTesterReportMarkdown({ body }: AdminTesterReportMarkdownProps) {
  const blocks = parseMarkdownBlocks(body);

  if (blocks.length === 0) {
    return <div className={styles.adminTesterReportMarkdown}>No report body recorded.</div>;
  }

  return (
    <div className={styles.adminTesterReportMarkdown}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const HeadingTag = `h${Math.min(5, block.level + 2)}` as "h3" | "h4" | "h5";
          return (
            <HeadingTag key={`${block.type}-${index}`}>
              {renderInlineMarkdown(block.text)}
            </HeadingTag>
          );
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag key={`${block.type}-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${block.type}-${index}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
              ))}
            </ListTag>
          );
        }

        if (block.type === "code") {
          return <pre key={`${block.type}-${index}`}>{block.text}</pre>;
        }

        return <p key={`${block.type}-${index}`}>{renderInlineMarkdown(block.text)}</p>;
      })}
    </div>
  );
}
