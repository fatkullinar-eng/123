import type { Project } from "./model";
import { calculate, kitchenNames, scenarioNames, money } from "./model";
import { headers } from "./import";
export function download(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function backup(project: Project) {
  download(
    JSON.stringify(project, null, 2),
    "bar-project.json",
    "application/json",
  );
}
export async function exportEstimate(project: Project) {
  const result = calculate(project);
  if (!result.valid) throw new Error("Исправьте ошибки перед выгрузкой.");
  const ExcelJS = await import("exceljs");
  const book = new ExcelJS.default.Workbook();
  const summary = book.addWorksheet("Итоги");
  summary.addRows([
    ["Объект", project.name],
    ["Прайс", project.source],
    ["Площадь, м²", Number(project.params.area.replace(",", "."))],
    ["Посадочных мест", Number(project.params.seats)],
    ["Кранов", Number(project.params.taps)],
    ["Кухня", kitchenNames[project.params.kitchen]],
    ["Сценарий", scenarioNames[project.params.scenario]],
    ["Ремонт, мес.", Number(project.params.repair.replace(",", "."))],
    ["Каникулы, мес.", Number(project.params.holidays.replace(",", "."))],
    ["Статьи до резерва, ₽", result.subtotal],
    ["Резерв, ₽", result.reserve],
    ["Бюджет открытия, ₽", result.total],
    ["Возвратные средства (входят в бюджет), ₽", result.refundable],
    ["Бюджет без возвратных средств, ₽", result.total - result.refundable],
    [],
    ["Расчёт предварительный. Ставки и объём работ проверяет менеджер."],
    ["Страховые взносы — готовая ставка из прайса, не формула от ручного ФОТ."],
  ]);
  summary.columns = [{ width: 52 }, { width: 55 }];
  const detail = book.addWorksheet("Смета");
  detail.addRow([
    "ID",
    "Раздел",
    "Позиция",
    "Статус",
    "Применима",
    "Включена",
    "Кол-во",
    "Ед.",
    "Ставка, ₽ или %",
    "Сумма, ₽",
    "Возврат",
    "Ручная правка",
    "Комментарий",
  ]);
  for (const l of result.lines)
    detail.addRow([
      l.row.id,
      l.row.section,
      l.row.name,
      l.row.status,
      l.applicable ? "да" : "нет",
      l.included ? "да" : "нет",
      l.row.basis === "%" ? null : l.quantity,
      l.row.unit,
      l.rate,
      l.amount,
      l.row.refundable ? "да" : "",
      l.override.rate !== undefined || l.override.quantity !== undefined
        ? "да"
        : "",
      l.row.note,
    ]);
  detail.columns = [10, 24, 58, 20, 14, 14, 14, 14, 20, 20, 14, 18, 70].map(
    (width) => ({ width }),
  );
  for (const sheet of [summary, detail]) {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }
  for (let i = 2; i <= detail.rowCount; i++) {
    detail.getCell(i, 9).numFmt = "#,##0.00";
    detail.getCell(i, 10).numFmt = "#,##0.00";
  }
  detail.autoFilter = { from: "A1", to: "M1" };
  download(
    await book.xlsx.writeBuffer(),
    "bar-estimate.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
export async function exportPrice(project: Project) {
  const ExcelJS = await import("exceljs");
  const book = new ExcelJS.default.Workbook();
  const sheet = book.addWorksheet("Справочник затрат");
  sheet.addRow(headers);
  for (const r of project.prices)
    sheet.addRow([
      r.id,
      r.section,
      r.subsection,
      r.name,
      r.type,
      r.unit,
      r.min,
      r.base,
      r.max,
      r.status,
      r.applies,
      r.basis,
      r.quantity,
      r.note,
      r.refundable ? "да" : "",
    ]);
  sheet.columns = headers.map((_, i) => ({
    width: i === 3 || i === 13 ? 60 : 20,
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  download(
    await book.xlsx.writeBuffer(),
    "bar-price-template.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
