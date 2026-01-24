// Simple check: ensure each docs/api-*.md file is referenced in docs/README.md.
// Run with: node scripts/check_docs_links.js
import fs from "fs";
import path from "path";

const DOCS_DIR = path.join(process.cwd(), "docs");
const README_PATH = path.join(DOCS_DIR, "README.md");

const apiDocs = fs
  .readdirSync(DOCS_DIR)
  .filter((file) => file.startsWith("api-") && file.endsWith(".md"));

const readme = fs.readFileSync(README_PATH, "utf8");

const missing = apiDocs.filter((file) => !readme.includes(`docs/${file}`));

if (missing.length) {
  console.error("Missing API doc links in docs/README.md:");
  missing.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

console.log("All API docs referenced in docs/README.md.");
