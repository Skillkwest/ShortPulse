#!/usr/bin/env node

/**
 * Palette report utility for dry-run normalization.
 * Scans CSS files, counts color literals, and surfaces near-duplicate clusters.
 */

import { spawnSync } from "node:child_process";

const COLOR_PATTERN = "#[0-9a-fA-F]{3,8}|rgba?\\([^\\)]*\\)|hsla?\\([^\\)]*\\)";

function parseArgs(argv) {
  const opts = {
    globs: [],
    root: "frontend/styles",
    rgbThreshold: 1,
    alphaThreshold: 0.03,
    top: 20,
    minClusterSize: 2,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--glob") {
      opts.globs.push(argv[++i]);
    } else if (arg === "--root") {
      opts.root = argv[++i];
    } else if (arg === "--rgb-threshold") {
      opts.rgbThreshold = Number(argv[++i]);
    } else if (arg === "--alpha-threshold") {
      opts.alphaThreshold = Number(argv[++i]);
    } else if (arg === "--top") {
      opts.top = Number(argv[++i]);
    } else if (arg === "--min-cluster-size") {
      opts.minClusterSize = Number(argv[++i]);
    } else if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  if (opts.globs.length === 0) {
    opts.globs = ["ai-studio-*.css"];
  }

  return opts;
}

function printHelp() {
  const text = `Usage:
  node skills/palette-normalizer/scripts/palette_report.mjs [options]

Options:
  --glob <pattern>          Repeatable rg glob filter (default: ai-studio-*.css)
  --root <path>             Scan root path (default: frontend/styles)
  --rgb-threshold <n>       Max per-channel RGB delta for near match (default: 1)
  --alpha-threshold <n>     Max alpha delta for near match (default: 0.03)
  --top <n>                 Number of top colors to print (default: 20)
  --min-cluster-size <n>    Minimum cluster member count (default: 2)
  --json                    Print JSON output
  -h, --help                Show this help
`;
  process.stdout.write(text);
}

function runRipgrep(opts) {
  const args = ["-n", "-o", COLOR_PATTERN];
  for (const g of opts.globs) {
    args.push("--glob", g);
  }
  args.push(opts.root);

  const result = spawnSync("rg", args, { encoding: "utf8" });

  if (result.error) {
    throw new Error(`Failed to run rg: ${result.error.message}`);
  }

  // rg exits 1 for no matches; treat as empty result.
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(result.stderr || `rg exited with code ${result.status}`);
  }

  const lines = result.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return lines;
}

function normalizeToken(token) {
  const t = token.trim();
  if (t.startsWith("#")) {
    return t.toLowerCase();
  }
  const fn = t.match(/^([a-zA-Z]+)\((.*)\)$/);
  if (!fn) {
    return t;
  }
  const name = fn[1].toLowerCase();
  const body = fn[2]
    .split(",")
    .map((part) => part.trim().replace(/\s+/g, " "))
    .join(", ");
  return `${name}(${body})`;
}

function parsePercentOrNumber(value, scale = 255) {
  const v = value.trim();
  if (v.endsWith("%")) {
    const n = Number(v.slice(0, -1));
    return (n / 100) * scale;
  }
  return Number(v);
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function hslToRgb(h, s, l) {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp(s, 0, 1);
  const ll = clamp(l, 0, 1);

  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hh < 60) {
    r1 = c;
    g1 = x;
  } else if (hh < 120) {
    r1 = x;
    g1 = c;
  } else if (hh < 180) {
    g1 = c;
    b1 = x;
  } else if (hh < 240) {
    g1 = x;
    b1 = c;
  } else if (hh < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  };
}

function parseColor(token) {
  const t = token.trim();

  if (t.startsWith("#")) {
    const hex = t.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const chars = hex.split("").map((c) => c + c);
      const r = parseInt(chars[0], 16);
      const g = parseInt(chars[1], 16);
      const b = parseInt(chars[2], 16);
      const a = chars[3] ? parseInt(chars[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
    return null;
  }

  const fn = t.match(/^([a-zA-Z]+)\((.*)\)$/);
  if (!fn) {
    return null;
  }

  const name = fn[1].toLowerCase();
  const parts = fn[2].split(",").map((p) => p.trim());

  if ((name === "rgb" || name === "rgba") && (parts.length === 3 || parts.length === 4)) {
    const r = clamp(parsePercentOrNumber(parts[0]), 0, 255);
    const g = clamp(parsePercentOrNumber(parts[1]), 0, 255);
    const b = clamp(parsePercentOrNumber(parts[2]), 0, 255);
    const a = parts[3] != null ? clamp(Number(parts[3]), 0, 1) : 1;
    return { r, g, b, a };
  }

  if ((name === "hsl" || name === "hsla") && (parts.length === 3 || parts.length === 4)) {
    const h = Number(parts[0]);
    const s = parsePercentOrNumber(parts[1], 1);
    const l = parsePercentOrNumber(parts[2], 1);
    const a = parts[3] != null ? clamp(Number(parts[3]), 0, 1) : 1;
    const rgb = hslToRgb(h, s, l);
    return { ...rgb, a };
  }

  return null;
}

function isNear(a, b, rgbThreshold, alphaThreshold) {
  const dr = Math.abs(a.r - b.r);
  const dg = Math.abs(a.g - b.g);
  const db = Math.abs(a.b - b.b);
  const da = Math.abs(a.a - b.a);
  return dr <= rgbThreshold && dg <= rgbThreshold && db <= rgbThreshold && da <= alphaThreshold;
}

function buildReport(lines, opts) {
  const colors = new Map();

  for (const line of lines) {
    const m = line.match(/^(.+?):(\d+):(.*)$/);
    if (!m) continue;
    const file = m[1];
    const normalized = normalizeToken(m[3]);
    if (!colors.has(normalized)) {
      colors.set(normalized, {
        value: normalized,
        count: 0,
        files: new Set(),
        parsed: parseColor(normalized),
      });
    }
    const entry = colors.get(normalized);
    entry.count += 1;
    entry.files.add(file);
  }

  const all = Array.from(colors.values());
  all.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

  const parsed = all.filter((c) => c.parsed != null);
  const parsedSorted = [...parsed].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  const assigned = new Set();
  const clusters = [];

  for (let i = 0; i < parsedSorted.length; i += 1) {
    if (assigned.has(i)) continue;
    const canonical = parsedSorted[i];
    const aliases = [];
    const aliasIndexes = [];

    for (let j = i + 1; j < parsedSorted.length; j += 1) {
      if (assigned.has(j)) continue;
      const candidate = parsedSorted[j];
      if (isNear(canonical.parsed, candidate.parsed, opts.rgbThreshold, opts.alphaThreshold)) {
        aliases.push(candidate);
        aliasIndexes.push(j);
      }
    }

    if (aliases.length + 1 >= opts.minClusterSize) {
      for (const aliasIndex of aliasIndexes) {
        assigned.add(aliasIndex);
      }
      const potentialReplacements = aliases.reduce((sum, e) => sum + e.count, 0);
      clusters.push({
        canonical,
        aliases,
        size: aliases.length + 1,
        potentialReplacements,
      });
    }
  }

  clusters.sort((a, b) => b.potentialReplacements - a.potentialReplacements || b.size - a.size);

  return {
    scannedRoot: opts.root,
    globs: opts.globs,
    thresholds: {
      rgb: opts.rgbThreshold,
      alpha: opts.alphaThreshold,
      minClusterSize: opts.minClusterSize,
    },
    totals: {
      colorReferences: all.reduce((sum, c) => sum + c.count, 0),
      uniqueColors: all.length,
      parseableColors: parsed.length,
      clusters: clusters.length,
    },
    topColors: all.slice(0, opts.top).map((c) => ({
      value: c.value,
      count: c.count,
      files: Array.from(c.files).sort(),
    })),
    clusters: clusters.map((c) => ({
      canonical: {
        value: c.canonical.value,
        count: c.canonical.count,
        files: Array.from(c.canonical.files).sort(),
      },
      aliases: c.aliases.map((a) => ({
        value: a.value,
        count: a.count,
        files: Array.from(a.files).sort(),
      })),
      size: c.size,
      potentialReplacements: c.potentialReplacements,
    })),
  };
}

function printText(report, opts) {
  const lines = [];
  lines.push("Palette normalization report");
  lines.push(`- Scope root: ${report.scannedRoot}`);
  lines.push(`- Globs: ${report.globs.join(", ")}`);
  lines.push(`- Thresholds: rgb<=${opts.rgbThreshold} alpha<=${opts.alphaThreshold}`);
  lines.push(`- Color refs: ${report.totals.colorReferences}`);
  lines.push(`- Unique colors: ${report.totals.uniqueColors}`);
  lines.push(`- Parseable colors: ${report.totals.parseableColors}`);
  lines.push(`- Near-duplicate clusters: ${report.totals.clusters}`);
  lines.push("");

  lines.push(`Top colors (first ${report.topColors.length})`);
  for (const c of report.topColors) {
    lines.push(`- ${c.value} | refs:${c.count} | files:${c.files.length}`);
  }

  lines.push("");
  lines.push("Candidate merges");
  if (report.clusters.length === 0) {
    lines.push("- none at current thresholds");
  } else {
    for (const cluster of report.clusters) {
      lines.push(
        `- canonical ${cluster.canonical.value} (refs:${cluster.canonical.count}) ` +
          `| aliases:${cluster.aliases.length} | replacement_refs:${cluster.potentialReplacements}`
      );
      for (const alias of cluster.aliases) {
        lines.push(`  - ${alias.value} -> ${cluster.canonical.value} | refs:${alias.count} files:${alias.files.length}`);
      }
    }
  }

  process.stdout.write(`${lines.join("\n")}\n`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  let lines;
  try {
    lines = runRipgrep(opts);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const report = buildReport(lines, opts);

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printText(report, opts);
  }
}

main();
