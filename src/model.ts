import Decimal from "decimal.js";
import initialPrices from "./data/price.json";

export type Scenario = "min" | "base" | "max";
export type Kitchen = "none" | "snacks" | "mini";
export interface Price {
  id: string;
  section: string;
  subsection: string;
  name: string;
  type: string;
  unit: string;
  min: number;
  base: number;
  max: number;
  status: string;
  applies: string;
  basis: string;
  quantity: number | null;
  note: string;
  refundable: boolean;
}
export interface Params {
  area: string;
  seats: string;
  taps: string;
  repair: string;
  holidays: string;
  kitchen: Kitchen;
  scenario: Scenario;
}
export interface Override {
  included?: boolean;
  quantity?: string;
  rate?: string;
}
export interface Project {
  id: string;
  name: string;
  updatedAt: string;
  source: string;
  prices: Price[];
  params: Params;
  overrides: Record<string, Override>;
}
export const defaults: Params = {
  area: "65",
  seats: "20",
  taps: "10",
  repair: "2",
  holidays: "2",
  kitchen: "none",
  scenario: "base",
};
export const basePrices = initialPrices as Price[];
export const scenarioNames: Record<Scenario, string> = {
  min: "Минимум",
  base: "База",
  max: "Максимум",
};
export const kitchenNames: Record<Kitchen, string> = {
  none: "Без кухни",
  snacks: "Закуски",
  mini: "Мини-кухня",
};
export const money = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(value);
export const num = (value: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(value);
export function numeric(value: string): number {
  return value.trim() === "" ? NaN : Number(value.replace(",", "."));
}
export function validateParams(
  p: Params,
): Partial<Record<keyof Params, string>> {
  const errors: Partial<Record<keyof Params, string>> = {};
  for (const key of ["area", "seats", "taps", "repair", "holidays"] as const) {
    const v = numeric(p[key]);
    const min = key === "area" ? 1 : 0;
    const max =
      key === "area"
        ? 10000
        : key === "repair" || key === "holidays"
          ? 120
          : 10000;
    if (
      !Number.isFinite(v) ||
      v < min ||
      v > max ||
      (["seats", "taps"].includes(key) && !Number.isInteger(v))
    )
      errors[key] =
        `Введите ${["seats", "taps"].includes(key) ? "целое " : ""}число от ${min} до ${max}.`;
  }
  return errors;
}
export function isApplicable(row: Price, kitchen: Kitchen) {
  return (
    row.applies === "Всегда" ||
    (row.applies === "Кухня: закуски" && kitchen !== "none") ||
    (row.applies === "Кухня: мини" && kitchen === "mini")
  );
}
export interface Line {
  row: Price;
  included: boolean;
  applicable: boolean;
  quantity: number;
  rate: number;
  amount: number;
  override: Override;
  error?: string;
}
export function calculate(
  project: Project,
  scenario: Scenario = project.params.scenario,
) {
  const p = project.params;
  const errors = validateParams(p);
  let running = new Decimal(0),
    reserve = new Decimal(0),
    refundable = new Decimal(0);
  const groups: Record<string, number> = {};
  const lines: Line[] = project.prices.map((row) => {
    const o = project.overrides[row.id] || {};
    const applicable = isApplicable(row, p.kitchen);
    const included =
      applicable &&
      (row.status === "Обязательно" || (o.included ?? row.status !== "Опция"));
    const autoQuantity = (
      {
        м2: numeric(p.area),
        место: numeric(p.seats),
        кран: numeric(p.taps),
        "м2-мес":
          numeric(p.area) *
          Math.max(0, numeric(p.repair) - numeric(p.holidays)),
        комплект: 1,
        шт: row.quantity ?? 1,
        "%": 1,
      } as Record<string, number>
    )[row.basis];
    const quantity =
      o.quantity === undefined ? autoQuantity : numeric(o.quantity);
    const rate = o.rate === undefined ? row[scenario] : numeric(o.rate);
    let error: string | undefined;
    if (
      !Number.isFinite(rate) ||
      rate < 0 ||
      rate > 1e10 ||
      (row.basis === "%" && rate > 100)
    )
      error =
        "Некорректная ставка. Допустимы неотрицательные числа; процент — до 100.";
    if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1e7)
      error = "Количество должно быть от 0 до 10 000 000.";
    let amount = 0;
    if (included && !error && !Object.keys(errors).length) {
      const amountDecimal = (
        row.basis === "%"
          ? running.times(rate).div(100)
          : new Decimal(rate).times(quantity)
      ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      if (running.plus(amountDecimal).greaterThan(1e12)) {
        error =
          "Бюджет превышает лимит 1 трлн ₽. Проверьте ставку и количество.";
      } else {
        amount = amountDecimal.toNumber();
        running = running.plus(amountDecimal);
        if (row.basis === "%") reserve = reserve.plus(amountDecimal);
        if (row.refundable) refundable = refundable.plus(amountDecimal);
        groups[row.section] = new Decimal(groups[row.section] || 0)
          .plus(amountDecimal)
          .toNumber();
      }
    }
    return {
      row,
      included,
      applicable,
      quantity,
      rate,
      amount,
      override: o,
      error,
    };
  });
  const valid = !Object.keys(errors).length && !lines.some((l) => l.error);
  return {
    lines,
    groups,
    errors,
    valid,
    total: running.toNumber(),
    reserve: reserve.toNumber(),
    refundable: refundable.toNumber(),
    subtotal: running.minus(reserve).toNumber(),
    includedCount: lines.filter((l) => l.included).length,
  };
}
export function newProject(): Project {
  return {
    id: crypto.randomUUID(),
    name: "Новый пивной бар",
    updatedAt: new Date().toISOString(),
    source: "Прайс от 28.10.2026",
    prices: structuredClone(basePrices),
    params: { ...defaults },
    overrides: {},
  };
}
