import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve("dist");
const server = createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(
      new URL(req.url, "http://127.0.0.1").pathname,
    );
    const target = path.resolve(
      root,
      "." + (name === "/" ? "/index.html" : name),
    );
    if (!target.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    const mime =
      {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript",
        ".css": "text/css",
      }[path.extname(target)] || "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.end(await fs.readFile(target));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page
    .getByRole("heading", { name: "Соберите стоимость объекта" })
    .waitFor();
  assert.match(await page.locator(".total").innerText(), /8\s*003\s*520/);
  await page
    .getByRole("button", { name: "Загрузить данные", exact: true })
    .click();
  await page
    .getByLabel("Выбрать прайс", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/original-price.xlsx"));
  await page.getByRole("heading", { name: "Прайс прошёл проверку" }).waitFor();
  await page
    .getByRole("button", { name: "Применить прайс", exact: true })
    .click();
  await context.setOffline(true);
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Выгрузить смету XLSX", exact: true })
    .click();
  await (await downloaded).saveAs("test-results/production-export.xlsx");
  assert.deepEqual(errors, []);
  console.log(
    "PASS production bundle: startup and XLSX import via static server; XLSX export after going offline",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
