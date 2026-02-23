// Legacy naming runtime-usage guard for AI Studio canonicalization.
// Run with: node scripts/check_naming_legacy_usage.js
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.cwd();
const FRONTEND_DIR = path.join(REPO_ROOT, "frontend");

const LEGACY_PATTERNS = [
  /\bReferenceCanvas\b/g,
  /\bReferenceCanvasProps\b/g,
  /\bTextPropertiesPanel\b/g,
  /\bTextPropertiesPanelProps\b/g,
  /\buseAiStudioReferenceCanvasProps\b/g,
  /\bReferenceCanvasDropMode\b/g,
  /\bReferenceCanvasCard\b/g,
  /\bReferenceCanvasSections\b/g,
  /\bReferenceCanvasArchiveControls\b/g,
  /\breferenceCanvasProps\b/g,
  /\breferenceCanvasFileInputRef\b/g,
  /\bhandleReferenceCanvasFiles\b/g,
  /\bpropertiesText\b/g,
];

const ALLOWED_FILES = new Set(
  [
    "frontend/features/ai-studio/components/AiStudioPageContent.tsx",
    "frontend/features/ai-studio/components/CreatePropertiesPanel.tsx",
    "frontend/features/ai-studio/components/ReferenceCanvas.tsx",
    "frontend/features/ai-studio/components/ReferenceGrid.tsx",
    "frontend/features/ai-studio/components/TextPropertiesPanel.tsx",
    "frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts",
    "frontend/features/ai-studio/hooks/useAiStudioReferenceCanvasProps.ts",
    "frontend/features/ai-studio/hooks/useAiStudioReferenceGridProps.ts",
    "frontend/features/ai-studio/hooks/useAiStudioWorkspaceActions.ts",
    "frontend/features/ai-studio/reference-grid/components/ReferenceGridArchiveControls.tsx",
    "frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx",
    "frontend/features/ai-studio/reference-grid/components/ReferenceGridSections.tsx",
    "frontend/features/ai-studio/reference-grid/controllers/useReferenceGridDropController.ts",
  ].map((value) => path.normalize(value))
);

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist") {
        continue;
      }
      walkFiles(fullPath, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
    if (/\.test\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
    if (fullPath.includes(`${path.sep}__tests__${path.sep}`)) continue;
    out.push(fullPath);
  }
  return out;
}

function run() {
  const files = walkFiles(FRONTEND_DIR);
  const violations = [];

  for (const filePath of files) {
    const relPath = path.normalize(path.relative(REPO_ROOT, filePath));
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const hasLegacyToken = LEGACY_PATTERNS.some((pattern) => {
        pattern.lastIndex = 0;
        return pattern.test(line);
      });
      if (!hasLegacyToken) continue;
      if (ALLOWED_FILES.has(relPath)) continue;
      violations.push(`${relPath}:${i + 1} contains legacy naming token.`);
    }
  }

  if (violations.length > 0) {
    console.error("Legacy naming usage check failed:");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log("Legacy naming usage checks passed.");
}

run();
