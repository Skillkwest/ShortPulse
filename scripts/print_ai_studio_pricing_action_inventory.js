#!/usr/bin/env node
const {
  explicitExclusions,
  phase1Actions,
} = require("./lib/ai_studio_pricing_action_inventory.js");

const renderSection = (title, rows) => {
  const lines = [
    title,
    "",
    "| id | classification | surface | submit path | server debit |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const row of rows) {
    lines.push(
      `| ${row.id} | ${row.classification} | ${row.surface} | ${row.submitPath} | ${row.serverDebitPath} |`
    );
  }

  return lines.join("\n");
};

const renderDetailSection = (rows) =>
  rows
    .map((row) =>
      [
        `### ${row.id}`,
        `- Surface: ${row.surface}`,
        `- Classification: ${row.classification}`,
        `- Trigger: ${row.trigger}`,
        `- Model source: ${row.modelIdSource}`,
        `- Pricing display: ${row.pricingDisplaySource}`,
        `- Submit path: ${row.submitPath}`,
        `- Server debit: ${row.serverDebitPath}`,
        `- References: ${row.references.join(", ")}`,
      ].join("\n")
    )
    .join("\n\n");

console.log("# AI Studio Pricing Action Inventory\n");
console.log(renderSection("## Phase 1 billable actions", phase1Actions));
console.log("");
console.log(renderSection("## Explicit helper exclusions", explicitExclusions));
console.log("");
console.log("## Detailed entries\n");
console.log(renderDetailSection([...phase1Actions, ...explicitExclusions]));
