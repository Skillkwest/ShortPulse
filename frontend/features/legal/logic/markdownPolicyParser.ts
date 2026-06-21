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
    }
  | {
      headers: string[];
      id: string;
      rows: string[][];
      type: "table";
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

const isTableRow = (line: string) => line.startsWith("|") && line.endsWith("|");

const splitTableRow = (line: string) =>
  line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

const isTableDelimiterRow = (cells: string[]) =>
  cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));

export function parseLegalPolicyMarkdown(markdown: string): ParsedLegalPolicy {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: LegalPolicyBlock[] = [];
  let title = "";
  let publicationStatus: string | null = null;
  let lastUpdated: string | null = null;
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let tableRows: string[][] = [];

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

  const flushTable = () => {
    if (tableRows.length > 0) {
      const [headerRow, ...bodyRows] = tableRows;
      const rows = bodyRows.filter((row) => !isTableDelimiterRow(row));
      if (headerRow.length > 0 && rows.length > 0) {
        blocks.push({
          headers: headerRow,
          id: `table-${blocks.length + 1}`,
          rows,
          type: "table",
        });
      } else {
        paragraphLines.push(...tableRows.map((row) => `| ${row.join(" | ")} |`));
      }
    }
    tableRows = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    if (line.startsWith("# ")) {
      flushTable();
      title = line.replace(/^#\s+/, "").trim();
      continue;
    }

    if (line.startsWith("Publication status:")) {
      flushTable();
      publicationStatus = line.replace(/^Publication status:\s*/, "").trim();
      continue;
    }

    if (line.startsWith("Last updated:")) {
      flushTable();
      lastUpdated = line.replace(/^Last updated:\s*/, "").trim();
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      flushTable();
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
      flushTable();
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
      flushTable();
      listItems.push(line.replace(/^-\s+/, "").trim());
      continue;
    }

    if (isTableRow(line)) {
      flushParagraph();
      flushList();
      tableRows.push(splitTableRow(line));
      continue;
    }

    flushList();
    flushTable();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();
  flushTable();

  return {
    blocks,
    lastUpdated,
    publicationStatus,
    title,
  };
}
