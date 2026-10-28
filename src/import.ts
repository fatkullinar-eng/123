import Papa from "papaparse";
import type { Price, Project } from "./model";
import { validateParams } from "./model";

export const headers = [
  "ID",
  "Раздел",
  "Подраздел",
  "Позиция",
  "Тип",
  "Ед",
  "Мин",
  "База",
  "Макс",
  "Статус",
  "Применимость",
  "База количества",
  "Кол-во",
  "Комментарий",
  "Возврат",
];
export const MAX_ROWS = 2000;
const bases = ["м2", "место", "кран", "м2-мес", "комплект", "шт", "%"];
const statuses = ["Обязательно", "Рекомендуется", "По ситуации", "Опция"];
const applicability = ["Всегда", "Кухня: закуски", "Кухня: мини"];
function text(v: unknown) {
  return v == null ? "" : String(v).trim();
}
function number(v: unknown, label: string, line: number) {
  const raw = text(v);
  const n = Number(raw.replace(",", "."));
  if (!raw || !Number.isFinite(n) || n < 0 || n > 1e10)
    throw new Error(
      `Строка ${line}: «${label}» должна содержать число от 0 до 10 000 000 000.`,
    );
  return n;
}
export function parseRows(rows: unknown[][]): Price[] {
  const data = rows.filter((row) => row.some((v) => text(v) !== ""));
  if (data.length < 2)
    throw new Error(
      "В таблице нет позиций. Добавьте заголовки и хотя бы одну строку.",
    );
  if (data.length > MAX_ROWS + 1)
    throw new Error(`В прайсе допустимо не более ${MAX_ROWS} позиций.`);
  const names = data[0].map((v) => text(v).replace(/^\uFEFF/, ""));
  for (const h of headers.slice(0, 13))
    if (!names.includes(h))
      throw new Error(`Не найдена колонка «${h}». Используйте шаблон прайса.`);
  if (new Set(names.filter(Boolean)).size !== names.filter(Boolean).length)
    throw new Error("Заголовки колонок не должны повторяться.");
  const ids = new Set<string>();
  return data.slice(1).map((row, i) => {
    const line = i + 2;
    const get = (name: string) => row[names.indexOf(name)];
    const id = text(get("ID"));
    if (
      !id ||
      id.length > 100 ||
      ids.has(id) ||
      ["__proto__", "constructor", "prototype"].includes(id)
    )
      throw new Error(
        `Строка ${line}: ID должен быть уникальным и непустым (до 100 символов).`,
      );
    ids.add(id);
    const name = text(get("Позиция")),
      section = text(get("Раздел"));
    if (!name || !section || name.length > 1000 || section.length > 200)
      throw new Error(
        `Строка ${line}: заполните «Позиция» и «Раздел» (до 1000 и 200 символов).`,
      );
    if (["__proto__", "constructor", "prototype"].includes(section))
      throw new Error(`Строка ${line}: недопустимое название раздела.`);
    const basis = text(get("База количества"))
      .replaceAll("²", "2")
      .replaceAll("·", "-");
    const status = text(get("Статус")),
      applies = text(get("Применимость"));
    if (!bases.includes(basis))
      throw new Error(
        `Строка ${line}: неизвестная база количества «${basis}».`,
      );
    if (!statuses.includes(status))
      throw new Error(`Строка ${line}: неизвестный статус «${status}».`);
    if (!applicability.includes(applies))
      throw new Error(`Строка ${line}: неизвестная применимость «${applies}».`);
    const min = number(get("Мин"), "Мин", line),
      base = number(get("База"), "База", line),
      max = number(get("Макс"), "Макс", line);
    if (min > base || base > max)
      throw new Error(`Строка ${line}: соблюдайте порядок Мин ≤ База ≤ Макс.`);
    if (basis === "%" && max > 100)
      throw new Error(`Строка ${line}: процент не должен превышать 100.`);
    const quantity = text(get("Кол-во"))
      ? number(get("Кол-во"), "Кол-во", line)
      : null;
    if (basis === "шт" && quantity === null)
      throw new Error(`Строка ${line}: укажите «Кол-во» для штучной позиции.`);
    if (quantity !== null && quantity > 1e7)
      throw new Error(
        `Строка ${line}: количество не должно превышать 10 000 000.`,
      );
    return {
      id,
      section,
      name,
      basis,
      status,
      applies,
      min,
      base,
      max,
      quantity,
      subsection: text(get("Подраздел")),
      type: text(get("Тип")),
      unit: text(get("Ед")),
      note: text(get("Комментарий")).slice(0, 4000),
      refundable: text(get("Возврат")) !== "",
    };
  });
}
export async function readPrices(file: File): Promise<Price[]> {
  if (file.size === 0 || file.size > 5 * 1024 * 1024)
    throw new Error("Выберите непустой файл размером до 5 МБ.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") {
    const content = await file.text();
    if (content.includes("\uFFFD"))
      throw new Error(
        "CSV должен быть в кодировке UTF-8. Пересохраните файл в Excel.",
      );
    const result = Papa.parse<string[]>(content, { skipEmptyLines: "greedy" });
    if (result.errors.length)
      throw new Error(`Не удалось прочитать CSV: ${result.errors[0].message}`);
    return parseRows(result.data);
  }
  if (extension !== "xlsx")
    throw new Error(
      "Поддерживаются XLSX и CSV UTF-8. Для XLS сохраните копию в формате XLSX.",
    );
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.default.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error(
      "Не удалось открыть XLSX. Проверьте, что файл не повреждён и не защищён паролем.",
    );
  }
  const sheet =
    workbook.getWorksheet("Справочник затрат") || workbook.worksheets[0];
  if (!sheet || sheet.rowCount > MAX_ROWS + 1 || sheet.columnCount > 100)
    throw new Error(
      "Таблица пуста или превышает лимит: 2000 строк и 100 столбцов.",
    );
  const rows: unknown[][] = [];
  sheet.eachRow((row) => {
    const cells: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (cell.type === ExcelJS.default.ValueType.Formula)
        throw new Error(
          `Строка ${row.number}, столбец ${col}: замените формулу готовым значением. Формулы Excel не вычисляются.`,
        );
      const v = cell.value;
      cells[col - 1] = typeof v === "object" && v !== null ? cell.text : v;
    });
    rows.push(cells);
  });
  return parseRows(rows);
}
export function validateProject(value: unknown): Project {
  if (!value || typeof value !== "object")
    throw new Error("Неверный формат резервной копии.");
  const p = value as Project;
  if (
    typeof p.id !== "string" ||
    typeof p.name !== "string" ||
    p.name.length > 120 ||
    typeof p.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(p.updatedAt)) ||
    typeof p.source !== "string" ||
    !Array.isArray(p.prices) ||
    !p.params ||
    !p.overrides ||
    typeof p.overrides !== "object" ||
    Array.isArray(p.overrides)
  )
    throw new Error("В копии отсутствуют обязательные данные проекта.");
  for (const k of ["area", "seats", "taps", "repair", "holidays"] as const)
    if (typeof p.params[k] !== "string")
      throw new Error("Некорректные параметры в копии.");
  if (
    !["none", "snacks", "mini"].includes(p.params.kitchen) ||
    !["min", "base", "max"].includes(p.params.scenario) ||
    Object.keys(validateParams(p.params)).length
  )
    throw new Error("Некорректные параметры в копии.");
  const prices = parseRows([
    headers,
    ...p.prices.map((r) => [
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
    ]),
  ]);
  const overrides: Project["overrides"] = {};
  for (const row of prices) {
    const o = p.overrides[row.id];
    if (!o) continue;
    if (
      typeof o !== "object" ||
      (o.included !== undefined && typeof o.included !== "boolean")
    )
      throw new Error("Некорректные настройки позиций.");
    for (const k of ["rate", "quantity"] as const)
      if (
        o[k] !== undefined &&
        (typeof o[k] !== "string" ||
          !o[k].trim() ||
          !Number.isFinite(Number(o[k].replace(",", "."))) ||
          Number(o[k].replace(",", ".")) < 0 ||
          Number(o[k].replace(",", ".")) >
            (k === "quantity" ? 1e7 : row.basis === "%" ? 100 : 1e10))
      )
        throw new Error("Некорректные ручные значения.");
    overrides[row.id] = {
      included: o.included,
      rate: o.rate,
      quantity: o.quantity,
    };
  }
  return {
    id: p.id,
    name: p.name,
    updatedAt: p.updatedAt,
    source: p.source,
    prices,
    params: p.params,
    overrides,
  };
}
