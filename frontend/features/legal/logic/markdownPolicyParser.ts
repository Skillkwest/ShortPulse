export type LegalPolicyBlock =
  | {
      id: string;
      level: 2 | 3;
      text: string;
      type: "heading";
    }
  | {
      id: string;
      text: string;
      type: "paragraph";
    }
  | {
      id: string;
      items: string[];
      type: "list";
    };

export type ParsedLegalPolicy = {
  title: string;
  publicationStatus: string | null;
  lastUpdated: string | null;
  blocks: LegalPolicyBlock[];
};

const normalizeParagraph = (lines: string[]) =>
  lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

const slugifyHeading = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function parseLegalPolicyMarkdown(markdown: string): ParsedLegalPolicy {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: LegalPolicyBlock[] = [];
  let title = "";
  let publicationStatus: string | null = null;
  let lastUpdated: string | null = null;
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    const text = normalizeParagraph(paragraphLines);
    if (text) {
      blocks.push({
        id: `paragraph-${blocks.length + 1}`,
        text,
        type: "paragraph",
      });
    }
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({
        id: `list-${blocks.length + 1}`,
        items: listItems,
        type: "list",
      });
    }
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith("# ")) {
      title = line.replace(/^#\s+/, "").trim();
      continue;
    }

    if (line.startsWith("Publication status:")) {
      publicationStatus = line.replace(/^Publication status:\s*/, "").trim();
      continue;
    }

    if (line.startsWith("Last updated:")) {
      lastUpdated = line.replace(/^Last updated:\s*/, "").trim();
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      const text = line.replace(/^##\s+/, "").trim();
      blocks.push({
        id: slugifyHeading(text) || `heading-${blocks.length + 1}`,
        level: 2,
        text,
        type: "heading",
      });
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      const text = line.replace(/^###\s+/, "").trim();
      blocks.push({
        id: slugifyHeading(text) || `heading-${blocks.length + 1}`,
        level: 3,
        text,
        type: "heading",
      });
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      listItems.push(line.replace(/^-\s+/, "").trim());
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return {
    blocks,
    lastUpdated,
    publicationStatus,
    title,
  };
}
