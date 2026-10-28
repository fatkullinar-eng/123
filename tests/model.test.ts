import { describe, expect, it } from "vitest";
import {
  basePrices,
  calculate,
  defaults,
  newProject,
  type Kitchen,
  type Project,
} from "../src/model";
import { headers, parseRows, validateProject } from "../src/import";
import controls from "./control.json";

function fixture(): Project {
  return {
    ...newProject(),
    prices: structuredClone(basePrices),
    params: { ...defaults },
  };
}
describe("контрольные суммы исходного Excel", () => {
  for (const [area, kitchen, total] of controls)
    it(`${area}, ${kitchen}: ${total}`, () => {
      const p = fixture();
      p.params.area = String(area).split(" ")[0];
      p.params.taps = (
        { "50": "8", "65": "10", "80": "12" } as Record<string, string>
      )[p.params.area];
      p.params.kitchen = (
        {
          "Без кухни": "none",
          Закуски: "snacks",
          "Мини-кухня": "mini",
        } as Record<string, Kitchen>
      )[String(kitchen)];
      const result = calculate(p);
      expect(result.valid).toBe(true);
      expect(result.total).toBe(total);
    });
});
describe("правила сметы", () => {
  it("слишком большой бюджет блокируется до потери точности копеек", () => {
    const p = fixture();
    p.overrides["1"] = { rate: "10000000000", quantity: "10000000" };
    expect(calculate(p).valid).toBe(false);
  });
  it("некорректная ставка выключенной опции не сохраняется как корректный проект", () => {
    const p = fixture();
    p.overrides["4"] = { rate: "" };
    expect(calculate(p).valid).toBe(false);
  });
  it("депозит возвратный и входит в общий бюджет", () => {
    const p = fixture();
    expect(calculate(p).refundable).toBe(169000);
  });
  it("опции выключены, обязательные нельзя исключить", () => {
    const p = fixture();
    p.overrides["1"] = { included: false };
    const r = calculate(p);
    expect(r.lines.find((l) => l.row.id === "1")?.included).toBe(true);
    expect(
      r.lines.filter((l) => l.row.status === "Опция").every((l) => !l.included),
    ).toBe(true);
  });
  it("ремонт минус каникулы, не ниже нуля", () => {
    const p = fixture();
    p.params.holidays = "3";
    expect(calculate(p).lines.find((l) => l.row.id === "7")?.amount).toBe(0);
    p.params.holidays = "0";
    expect(calculate(p).lines.find((l) => l.row.id === "7")?.amount).toBe(
      169000,
    );
  });
  it("применимость кухни важнее ручного включения", () => {
    const p = fixture();
    p.overrides["41"] = { included: true };
    expect(calculate(p).lines.find((l) => l.row.id === "41")?.included).toBe(
      false,
    );
    p.params.kitchen = "mini";
    expect(calculate(p).lines.find((l) => l.row.id === "38")?.included).toBe(
      true,
    );
  });
  it("ручная ставка фиксирована в диапазоне", () => {
    const p = fixture();
    p.overrides["1"] = { rate: "123,45" };
    expect(calculate(p, "min").lines[0].amount).toBe(123.45);
    expect(calculate(p, "max").lines[0].amount).toBe(123.45);
  });
  it("дробные копейки округляются, резерв идёт после округления", () => {
    const p = fixture();
    p.prices = [
      { ...basePrices[0], base: 0.105 },
      { ...basePrices.at(-1)!, base: 10 },
    ];
    expect(calculate(p).total).toBe(0.12);
  });
  it("пустые, отрицательные и бесконечные значения блокируют расчёт", () => {
    for (const value of ["", "-2", "abc", "Infinity"]) {
      const p = fixture();
      p.params.area = value;
      expect(calculate(p).valid).toBe(false);
    }
  });
  it("пустая ручная ставка не превращается в ноль", () => {
    const p = fixture();
    p.overrides["1"] = { rate: "" };
    expect(calculate(p).valid).toBe(false);
  });
  it("последовательные проценты включают предыдущий резерв", () => {
    const p = fixture();
    p.prices = [
      { ...basePrices[0], base: 100 },
      { ...basePrices.at(-1)!, id: "r1", base: 10 },
      { ...basePrices.at(-1)!, id: "r2", base: 10 },
    ];
    expect(calculate(p).total).toBe(121);
  });
});
const row = [
  "1",
  "Раздел",
  "Подраздел",
  "Название",
  "Услуга",
  "комплект",
  10,
  20,
  30,
  "Обязательно",
  "Всегда",
  "комплект",
  null,
  "",
  "",
];
describe("импорт", () => {
  it("считывает русские десятичные числа", () => {
    const r = [...row];
    r[7] = "20,5";
    expect(parseRows([headers, r])[0].base).toBe(20.5);
  });
  it("отклоняет дубликаты ID", () =>
    expect(() => parseRows([headers, row, row])).toThrow("уникальным"));
  it("отклоняет неизвестную основу и неверный порядок цен", () => {
    const r = [...row];
    r[11] = "неизвестно";
    expect(() => parseRows([headers, r])).toThrow("база");
    r[11] = "комплект";
    r[7] = 40;
    expect(() => parseRows([headers, r])).toThrow("порядок");
  });
  it("непустая отметка возврата учитывается буквально", () => {
    const r = [...row];
    r[14] = "нет";
    expect(parseRows([headers, r])[0].refundable).toBe(true);
  });
  it("копия хранит свой прайс и правки", () => {
    const p = fixture();
    p.overrides["1"] = { rate: "123" };
    const snapshot = validateProject(JSON.parse(JSON.stringify(p)));
    p.prices[0].base = 999999;
    expect(snapshot.prices[0].base).toBe(650000);
    expect(snapshot.overrides["1"].rate).toBe("123");
  });
  it("повреждённая JSON-копия не принимается", () => {
    expect(() => validateProject({})).toThrow();
    const p = fixture();
    p.overrides["1"] = { rate: "NaN" };
    expect(() => validateProject(p)).toThrow();
  });
});
