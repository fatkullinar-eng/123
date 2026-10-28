import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1520, height: 1080 },
});
const page = await context.newPage();
const reports = [];
try {
  await page.goto("http://127.0.0.1:5173");
  await page
    .getByRole("heading", { name: "Соберите стоимость объекта" })
    .waitFor();
  for (const surface of ["estimate", "import", "prices", "projects"]) {
    if (surface === "import")
      await page
        .getByRole("button", { name: "Загрузить данные", exact: true })
        .click();
    if (surface === "prices") {
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: "Прайс", exact: true })
        .first()
        .click();
    }
    if (surface === "projects")
      await page.getByRole("button", { name: /^Проекты/ }).click();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    reports.push({
      surface,
      violations: result.violations,
      incomplete: result.incomplete,
    });
    console.log(
      surface,
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    );
  }
  await fs.mkdir("test-results", { recursive: true });
  await fs.writeFile(
    "test-results/accessibility.json",
    JSON.stringify(reports, null, 2),
  );
  assert.equal(
    reports.reduce((n, r) => n + r.violations.length, 0),
    0,
  );
} finally {
  await browser.close();
}
