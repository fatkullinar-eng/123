import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1520, height: 1080 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const results = [];
const record = (name) => {
  results.push(name);
  console.log("PASS", name);
};
try {
  await page.goto("http://127.0.0.1:5173");
  await page
    .getByRole("heading", { name: "Соберите стоимость объекта" })
    .waitFor();
  assert.match(await page.locator(".total").innerText(), /8\s*003\s*520/);
  record("Базовая сумма 8 003 520 ₽");
  await fs.mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page.getByLabel("Площадь помещения", { exact: true }).fill("50");
  await page.getByLabel("Пивных кранов", { exact: true }).fill("8");
  assert.match(await page.locator(".total").innerText(), /7\s*640\s*640/);
  await page.getByLabel("Формат кухни", { exact: true }).selectOption("mini");
  assert.match(await page.locator(".total").innerText(), /8\s*346\s*240/);
  record("Площадь и мини-кухня меняют бюджет по контрольной сумме");
  await page.getByLabel("Площадь помещения", { exact: true }).fill("");
  assert.equal(
    await page
      .getByRole("button", { name: "Сохранить проект", exact: true })
      .isDisabled(),
    true,
  );
  assert.match(await page.locator(".total").innerText(), /—/);
  await page.getByLabel("Площадь помещения", { exact: true }).fill("65");
  await page.getByLabel("Пивных кранов", { exact: true }).fill("10");
  record("Некорректный параметр блокирует смету и сохранение");
  await page
    .getByRole("button", { name: "Сохранить проект", exact: true })
    .click();
  await page.getByRole("button", { name: /^Проекты/ }).click();
  assert.equal(await page.locator(".project-card").count(), 1);
  await page.getByRole("button", { name: "Открыть", exact: true }).click();
  await page
    .getByRole("button", { name: "Открыть вместо черновика", exact: true })
    .click();
  await page.waitForTimeout(600);
  await page.reload();
  await page
    .getByRole("heading", { name: "Соберите стоимость объекта" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Формат кухни", { exact: true }).inputValue(),
    "mini",
  );
  record("Сохранение проекта и восстановление после перезапуска");
  await page
    .getByRole("button", { name: "Загрузить данные", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
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
  record("Ошибочный CSV не заменяет прайс");
  const source = path.resolve("tests/fixtures/original-price.xlsx");
  await page.getByLabel("Выбрать прайс", { exact: true }).setInputFiles(source);
  await page.getByRole("heading", { name: "Прайс прошёл проверку" }).waitFor();
  assert.match(await page.locator(".import-preview").innerText(), /66 позиций/);
  await page.screenshot({ path: "test-results/import.png", fullPage: true });
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(
    await page
      .getByRole("button", { name: "Загрузить данные", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  record("XLSX, предпросмотр, Escape и возврат фокуса");
  await page
    .getByRole("button", { name: "Загрузить данные", exact: true })
    .click();
  await page.getByLabel("Выбрать прайс", { exact: true }).setInputFiles(source);
  await page.getByRole("heading", { name: "Прайс прошёл проверку" }).waitFor();
  await page
    .getByRole("button", { name: "Применить прайс", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  record("Применение нового прайса");
  await page
    .getByLabel("Поиск позиций", { exact: true })
    .fill("несуществующая статья");
  await page.getByRole("heading", { name: "Ничего не найдено" }).waitFor();
  await page
    .getByRole("button", { name: "Очистить поиск", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Поиск позиций", { exact: true }).inputValue(),
    "",
  );
  assert.equal(
    await page
      .getByLabel("Поиск позиций", { exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  record("Поиск, отсутствие результатов и очистка");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Выгрузить смету XLSX", exact: true })
    .click();
  const download = await downloadPromise;
  await download.saveAs("test-results/export.xlsx");
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile("test-results/export.xlsx");
  assert.equal(workbook.getWorksheet("Смета").rowCount, 67);
  assert.equal(workbook.getWorksheet("Итоги").getCell("B12").value, 8709120);
  record("Экспорт XLSX: 66 строк и точный итог");
  const backupPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON-копия", exact: true }).click();
  const backup = await backupPromise;
  await backup.saveAs("test-results/project.json");
  await page.getByRole("button", { name: /^Проекты/ }).click();
  await page
    .getByLabel("JSON-копия проекта", { exact: true })
    .setInputFiles("test-results/project.json");
  await page
    .getByRole("button", { name: "Открыть вместо черновика", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Соберите стоимость объекта" })
    .waitFor();
  record("Выгрузка и восстановление JSON-копии");
  await context.setOffline(true);
  await page.getByLabel("Площадь помещения", { exact: true }).fill("80");
  await page.getByLabel("Пивных кранов", { exact: true }).fill("12");
  assert.match(await page.locator(".total").innerText(), /9\s*072\s*000/);
  record("Расчёт без интернета");
  await context.setOffline(false);
  assert.notEqual(
    await page
      .locator("html")
      .evaluate((el) => getComputedStyle(el).scrollbarColor),
    "auto",
  );
  record("Глобальная тема полос прокрутки");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.getByLabel("Формат кухни", { exact: true }).selectOption("snacks");
  record("Узкий экран: без горизонтального переполнения страницы");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".button")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    "0s",
  );
  record("Режим уменьшенной анимации");
  await page.setViewportSize({ width: 1520, height: 1080 });
  await page.getByRole("button", { name: /^Проекты/ }).click();
  await page.getByRole("button", { name: /Удалить проект:/ }).click();
  await page.getByRole("dialog").waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Оставить проект", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page
    .getByRole("button", { name: "Удалить проект", exact: true })
    .click();
  assert.equal(await page.locator(".project-card").count(), 0);
  record("Подтверждение удаления и безопасный начальный фокус");
  assert.deepEqual(errors, []);
  record("Нет ошибок JavaScript");
  await fs.writeFile(
    "test-results/browser-report.json",
    JSON.stringify(
      { passed: results.length, checks: results, errors },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
