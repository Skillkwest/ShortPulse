#!/usr/bin/env node
/*
Purpose: build or audit Badu ledger TSV blocks using the active 19-column workbook shape.
This helper is local-only and intentionally does not connect to providers, Sheets, or secrets.
*/

import fs from "node:fs";

const HEADERS = [
  "Provider",
  "Date",
  "Time",
  "Provider Account",
  "Description",
  "Units",
  "Unit Type",
  "Transaction Type",
  "Category",
  "Amount USD",
  "Expense USD",
  "Income USD",
  "Net USD",
  "Currency",
  "Invoice Available",
  "Invoice Status",
  "Source URL",
  "Source Detail",
  "Notes",
];

const MONEY_COLUMNS = new Map([
  ["Amount USD", 9],
  ["Expense USD", 10],
  ["Income USD", 11],
  ["Net USD", 12],
]);

function usage(exitCode = 0) {
  const text = [
    "Usage:",
    "  node docs/agents/badu/tools/ledger-tsv-helper.mjs build <rows.json> > import.tsv",
    "  node docs/agents/badu/tools/ledger-tsv-helper.mjs audit <rows.tsv>",
    "",
    "build expects a JSON array of objects keyed by the ledger headers.",
    "audit expects a TSV with or without the header row.",
  ].join("\n");
  (exitCode === 0 ? console.log : console.error)(text);
  process.exit(exitCode);
}

function cleanCell(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\t/g, " ").replace(/\r?\n/g, " ").trim();
}

function parseMoney(value) {
  if (value === null || value === undefined || value === "") return 0;
  const normalized = String(value).replace(/[$,]/g, "").trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid money value: ${value}`);
  }
  return parsed;
}

function formatMoney(value) {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = parseMoney(value);
  return parsed.toFixed(2);
}

function readFile(path) {
  return fs.readFileSync(path, "utf8");
}

function build(path) {
  const rows = JSON.parse(readFile(path));
  if (!Array.isArray(rows)) {
    throw new Error("Input JSON must be an array of ledger row objects.");
  }

  const output = rows.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`Row ${index + 1} must be an object.`);
    }

    return HEADERS.map((header) => {
      if (
        MONEY_COLUMNS.has(header) &&
        row[header] !== "" &&
        row[header] !== undefined
      ) {
        return formatMoney(row[header]);
      }
      return cleanCell(row[header]);
    }).join("\t");
  });

  console.log(output.join("\n"));
  summarize(output, "Build summary");
}

function audit(path) {
  const lines = readFile(path)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  const dataLines =
    lines[0]
      ?.split("\t")
      .map((cell) => cell.trim())
      .join("\t") === HEADERS.join("\t")
      ? lines.slice(1)
      : lines;

  summarize(dataLines, "Audit summary");
}

function summarize(lines, label) {
  const totals = {
    rows: lines.length,
    amount: 0,
    expense: 0,
    income: 0,
    net: 0,
    invalidColumnRows: [],
  };

  lines.forEach((line, index) => {
    const cells = line.split("\t");
    if (cells.length !== HEADERS.length) {
      totals.invalidColumnRows.push(`${index + 1}:${cells.length}`);
      return;
    }
    totals.amount += parseMoney(cells[MONEY_COLUMNS.get("Amount USD")]);
    totals.expense += parseMoney(cells[MONEY_COLUMNS.get("Expense USD")]);
    totals.income += parseMoney(cells[MONEY_COLUMNS.get("Income USD")]);
    totals.net += parseMoney(cells[MONEY_COLUMNS.get("Net USD")]);
  });

  const report = [
    `${label}:`,
    `  rows: ${totals.rows}`,
    `  amount: ${totals.amount.toFixed(2)}`,
    `  expense: ${totals.expense.toFixed(2)}`,
    `  income: ${totals.income.toFixed(2)}`,
    `  net: ${totals.net.toFixed(2)}`,
    `  invalid column rows: ${totals.invalidColumnRows.length ? totals.invalidColumnRows.join(", ") : "none"}`,
  ].join("\n");

  console.error(report);
}

const [, , mode, path] = process.argv;

try {
  if (!mode || mode === "--help" || mode === "-h") usage(0);
  if (!path) usage(1);
  if (mode === "build") build(path);
  else if (mode === "audit") audit(path);
  else usage(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
