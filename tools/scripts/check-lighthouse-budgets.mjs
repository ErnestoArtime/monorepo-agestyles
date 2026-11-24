import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Lighthouse budgets for the public catalog (AG-59, Fase 2).
 *
 * Usage: node tools/scripts/check-lighthouse-budgets.mjs <reports-dir>
 * The CI step runs Lighthouse (desktop preset) on the home, stores and news
 * pages of the disposable build and writes one *.report.json per page here.
 * These are starting budgets, not golden numbers: the first CI run shows
 * where the site really stands, and the design doc (AG-59) says how to
 * retune them. A breach fails the step so regressions cannot slip in
 * silently; the HTML reports are uploaded as an artifact either way.
 */

const BUDGETS = {
  performance: 0.8,
  accessibility: 0.9,
  "best-practices": 0.9,
  seo: 0.9,
  "largest-contentful-paint": 3000,
  "cumulative-layout-shift": 0.1,
  "interaction-to-next-paint": 300,
};

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: node tools/scripts/check-lighthouse-budgets.mjs <reports-dir>");
  process.exit(2);
}

const reports = readdirSync(dir)
  .filter((file) => file.endsWith(".report.json"))
  .sort();
if (!reports.length) {
  console.error(`No Lighthouse reports in ${dir}`);
  process.exit(2);
}

let failed = false;
for (const file of reports) {
  const report = JSON.parse(readFileSync(join(dir, file), "utf8"));
  const page = report.finalUrl ?? file;
  const checks = [];
  for (const category of ["performance", "accessibility", "best-practices", "seo"]) {
    const score = report.categories?.[category]?.score;
    const ok = typeof score === "number" && score >= BUDGETS[category];
    checks.push({ label: category, value: score ?? null, budget: `>= ${BUDGETS[category]}`, ok });
    if (!ok) failed = true;
  }
  for (const auditId of [
    "largest-contentful-paint",
    "cumulative-layout-shift",
    "interaction-to-next-paint",
  ]) {
    const numericValue = report.audits?.[auditId]?.numericValue;
    const ok = typeof numericValue === "number" && numericValue <= BUDGETS[auditId];
    checks.push({
      label: auditId,
      value: numericValue ?? null,
      budget: `<= ${BUDGETS[auditId]}`,
      ok,
    });
    if (!ok) failed = true;
  }
  console.log(`\n${page}`);
  for (const check of checks) {
    const shown =
      typeof check.value === "number" ? Math.round(check.value * 100) / 100 : "sin dato";
    console.log(`  ${check.ok ? "ok  " : "FAIL"} ${check.label}: ${shown} (${check.budget})`);
  }
}

if (failed) {
  console.error(
    "\nLighthouse budgets breached. See the uploaded HTML reports and docs/design/AG-59-legales-analytics-vistas-clics.md for how to retune or fix.",
  );
  process.exit(1);
}
console.log("\nLighthouse budgets: ok.");
