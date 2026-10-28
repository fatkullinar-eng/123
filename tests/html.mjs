import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";

const html = await fs.readFile("Bar-Estimate.html", "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
assert.ok(script, "Classic inline script exists");
assert.ok(html.includes("<style>"));
assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)=/i);
assert.doesNotMatch(script, /\bimport\s*\(/);
assert.ok(html.includes("connect-src 'none'"));
assert.ok(
  html.includes(
    `sha256-${crypto.createHash("sha256").update(script).digest("base64")}`,
  ),
);

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const url = "http://127.0.0.1/offline-calculator.html";
const context = await browser.newContext({
  offline: true,
  acceptDownloads: true,
  viewport: { width: 1520, height: 1080 },
});
const external = [],
  errors = [],
  checks = [];
// The managed browser forbids file://. Fulfil the entire document from memory,
// with networking offline, so no dev server or asset loading can hide dependencies.
await context.route("**/*", (route) => {
  if (route.request().url() === url)
    return route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: html,
    });
  external.push(route.request().url());
  return route.abort();
});
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
const pass = (name) => {
  checks.push(name);
  console.log("PASS", name);
};
try {
  await page.goto(url);
  await page
    .getByRole("heading", { name: "Соберите стоимость объекта" })
    .waitFor();
  assert.match(await page.locator(".total").innerText(), /8\s*003\s*520/);
  assert.match(await page.locator(".topbar").innerText(), /HTML · офлайн/);
  pass(
    "Автономный холодный запуск, встроенный прайс, CSP-хеш и отсутствие внешних ресурсов",
  );
  await page.getByLabel("Площадь помещения", { exact: true }).fill("80");
  await page.getByLabel("Пивных кранов", { exact: true }).fill("12");
  await page.getByLabel("Формат кухни", { exact: true }).selectOption("mini");
  assert.match(await page.locator(".total").innerText(), /9\s*072\s*000/);
  pass("Контрольная смета 80 м² / 20 мест / 12 кранов / мини-кухня");
  await page
    .getByRole("button", { name: "Сохранить проект", exact: true })
    .click();
  await page.waitForTimeout(500);
  await page.reload();
  await page
    .getByRole("heading", { name: "Соберите стоимость объекта" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Площадь помещения", { exact: true }).inputValue(),
    "80",
  );
  pass("Сохранение и перезагрузка браузерного черновика");
  await page
    .getByRole("button", { name: "Загрузить данные", exact: true })
    .click();
  await page
    .getByLabel("Выбрать прайс", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/original-price.xlsx"));
  await page.getByRole("heading", { name: "Прайс прошёл проверку" }).waitFor();
  assert.match(await page.locator(".import-preview").innerText(), /66 позиций/);
  await page
    .getByRole("button", { name: "Применить прайс", exact: true })
    .click();
  pass("XLSX-импорт работает без сети и загрузки библиотек");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Выгрузить смету XLSX", exact: true })
    .click();
  await fs.mkdir("test-results", { recursive: true });
  await (await downloaded).saveAs("test-results/html-estimate.xlsx");
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile("test-results/html-estimate.xlsx");
  assert.equal(workbook.getWorksheet("Смета").rowCount, 67);
  assert.equal(workbook.getWorksheet("Итоги").getCell("B12").value, 9072000);
  pass("Автономный экспорт XLSX: 66 строк и итог 9 072 000 ₽");
  const backup = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON-копия", exact: true }).click();
  await (await backup).saveAs("test-results/html-project.json");
  await page.getByRole("button", { name: /^Проекты/ }).click();
  await page
    .getByLabel("JSON-копия проекта", { exact: true })
    .setInputFiles("test-results/html-project.json");
  await page
    .getByRole("button", { name: "Открыть вместо черновика", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Соберите стоимость объекта" })
    .waitFor();
  pass("JSON-копия и восстановление с подтверждением");
  await page
    .getByRole("button", { name: "Загрузить данные", exact: true })
    .click();
  await page.getByLabel("Выбрать прайс", { exact: true }).setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("a;b\n1;2"),
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "Не найдена колонка" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Применить прайс", exact: true })
      .isDisabled(),
    true,
  );
  await page.keyboard.press("Escape");
  pass("Ошибочная таблица не заменяет прайс");
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(a11y.violations, []);
  pass("Автоматическая доступность HTML-версии");
  await page.screenshot({
    path: "test-results/html-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".button")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    "0s",
  );
  pass("Узкий экран и уменьшенная анимация");
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  pass("Нет ошибок JavaScript, CSP и внешних запросов");

  const limited = await browser.newContext({
    offline: true,
    acceptDownloads: true,
  });
  await limited.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Unavailable", "SecurityError");
      },
    });
  });
  await limited.route("**/*", (route) =>
    route.request().url() === url
      ? route.fulfill({ contentType: "text/html; charset=utf-8", body: html })
      : route.abort(),
  );
  const restricted = await limited.newPage();
  await restricted.goto(url);
  await restricted
    .getByRole("alert")
    .filter({ hasText: "Автосохранение остановлено" })
    .waitFor();
  assert.match(await restricted.locator(".total").innerText(), /8\s*003\s*520/);
  assert.equal(
    await restricted
      .getByRole("button", { name: "Сохранить проект", exact: true })
      .isDisabled(),
    true,
  );
  const recovery = restricted.waitForEvent("download");
  await restricted
    .getByRole("button", { name: "JSON-копия", exact: true })
    .click();
  await (await recovery).saveAs("test-results/html-storage-recovery.json");
  pass(
    "При запрете хранилища расчёт и JSON-экспорт доступны, сохранение блокируется",
  );
  await limited.close();
  await fs.writeFile(
    "test-results/html-report.json",
    JSON.stringify(
      {
        passed: checks.length,
        checks,
        errors,
        external,
        fileProtocol:
          "Blocked by managed Chromium policy; document tested entirely from memory while offline",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
