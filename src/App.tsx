import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileSpreadsheet,
  FolderOpen,
  HardDrive,
  Layers3,
  Plus,
  Printer,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
  Beer,
  Archive,
  Save,
} from "lucide-react";
import { Button, Field, Modal, Select } from "./ui";
import {
  calculate,
  kitchenNames,
  money,
  newProject,
  num,
  scenarioNames,
  type Kitchen,
  type Params,
  type Price,
  type Project,
  type Scenario,
} from "./model";
import { readPrices, validateProject } from "./import";
import { backup, exportEstimate, exportPrice } from "./export";
import {
  loadWorkspace,
  saveWorkspace,
  storageKey,
  type Workspace,
} from "./storage";

type View = "estimate" | "prices" | "projects";
type Dialog = "import" | "help" | "new" | null;
function boot(): { workspace: Workspace; error: string } {
  try {
    return {
      workspace: loadWorkspace() || { current: newProject(), saved: [] },
      error: "",
    };
  } catch {
    return {
      workspace: { current: newProject(), saved: [] },
      error:
        "Не удалось прочитать локальные данные. Чтобы не перезаписать их, автосохранение остановлено. Можно восстановить JSON-копию или выгрузить текущий расчёт.",
    };
  }
}
const initial = boot();
const standalone = import.meta.env.MODE === "standalone";
export default function App() {
  const [workspace, setWorkspace] = useState(initial.workspace);
  const project = workspace.current;
  const [view, setView] = useState<View>("estimate");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState("");
  const [storageError, setStorageError] = useState(initial.error);
  const [storageBlocked, setStorageBlocked] = useState(Boolean(initial.error));
  const [persisted, setPersisted] = useState(false);
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const composing = useRef(false);
  const [section, setSection] = useState("Все разделы");
  const [onlyIncluded, setOnlyIncluded] = useState(false);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [fileName, setFileName] = useState("");
  const [importError, setImportError] = useState("");
  const [preview, setPreview] = useState<Price[] | null>(null);
  const [reading, setReading] = useState(false);
  const importRun = useRef(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pendingProject, setPendingProject] = useState<Project | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const restoreInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const result = calculate(project);
  const valid =
    result.valid && Boolean(project.name.trim()) && project.name.length <= 120;
  const sections = [...new Set(project.prices.map((r) => r.section))];
  const filtered = result.lines.filter(
    (l) =>
      (section === "Все разделы" || l.row.section === section) &&
      (!onlyIncluded || l.included) &&
      `${l.row.name} ${l.row.section} ${l.row.subsection} ${l.row.note}`
        .toLocaleLowerCase("ru")
        .includes(query.toLocaleLowerCase("ru")),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const safePage = Math.min(page, pages - 1);
  const visible = filtered.slice(safePage * 20, safePage * 20 + 20);
  const change = (update: Partial<Project>) => {
    setPersisted(false);
    setWorkspace((old) => ({
      ...old,
      current: {
        ...old.current,
        ...update,
        updatedAt: new Date().toISOString(),
      },
    }));
  };
  const parameter = (key: keyof Params, value: string) =>
    change({ params: { ...project.params, [key]: value } });
  const lineChange = (
    id: string,
    key: "rate" | "quantity" | "included",
    value: string | boolean,
  ) =>
    change({
      overrides: {
        ...project.overrides,
        [id]: { ...project.overrides[id], [key]: value },
      },
    });
  useEffect(() => {
    document.title = `${view === "estimate" ? "Расчёт объекта" : view === "prices" ? "Прайс" : "Сохранённые проекты"} · Bar Estimate`;
  }, [view]);
  useEffect(() => {
    setPage(0);
  }, [query, section, onlyIncluded, view]);
  useEffect(() => {
    if (storageBlocked || !valid) return;
    const timer = setTimeout(() => {
      try {
        saveWorkspace(workspace);
        setPersisted(true);
        setStorageError("");
      } catch {
        setStorageError(
          "Не удалось сохранить данные на этом компьютере. Выгрузите JSON-копию проекта и освободите место.",
        );
        setPersisted(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [workspace, storageBlocked, valid]);
  useEffect(() => {
    const handle = (event: StorageEvent) => {
      if (event.key === storageKey) {
        setStorageBlocked(true);
        setStorageError(
          "Данные изменились в другом окне. Автосохранение остановлено. Сохраните JSON-копию ваших правок и перезапустите приложение.",
        );
      }
    };
    window.addEventListener("storage", handle);
    return () => window.removeEventListener("storage", handle);
  }, []);
  useEffect(() => {
    if (persisted) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [persisted]);
  async function action(name: string, fn: () => Promise<void> | void) {
    if (busy) return;
    setBusy(name);
    setActionError("");
    try {
      await fn();
      setNotice(`${name}: готово.`);
    } catch (e) {
      setActionError(
        e instanceof Error
          ? e.message
          : "Не удалось выполнить действие. Повторите попытку.",
      );
    } finally {
      setBusy("");
    }
  }
  function openImport() {
    setPreview(null);
    setFileName("");
    setImportError("");
    setDialog("import");
  }
  function closeImport() {
    importRun.current++;
    setReading(false);
    setDialog(null);
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    const run = ++importRun.current;
    setReading(true);
    setPreview(null);
    setImportError("");
    setFileName(file.name);
    try {
      const prices = await readPrices(file);
      if (importRun.current === run) setPreview(prices);
    } catch (e) {
      if (importRun.current === run)
        setImportError(
          e instanceof Error ? e.message : "Не удалось прочитать файл.",
        );
    } finally {
      if (importRun.current === run) setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function saveProject() {
    if (!valid) return;
    const snapshot = structuredClone({
      ...project,
      updatedAt: new Date().toISOString(),
    });
    const saved = [
      snapshot,
      ...workspace.saved.filter((p) => p.id !== snapshot.id),
    ];
    try {
      saveWorkspace({ ...workspace, saved });
      setWorkspace((old) => ({ ...old, saved }));
      setNotice(
        "Проект сохранён на этом компьютере. В снимок включены цены и ручные изменения.",
      );
    } catch {
      setActionError(
        "Не удалось сохранить проект. Выгрузите JSON-копию и освободите место.",
      );
    }
  }
  async function restoreFile(file: File | undefined) {
    if (!file) return;
    await action("Проверка JSON-копии", async () => {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Размер JSON-копии должен быть до 5 МБ.");
      const restored = validateProject(JSON.parse(await file.text()));
      setPendingProject(restored);
    });
    if (restoreInput.current) restoreInput.current.value = "";
  }
  const minResult = calculate(project, "min"),
    maxResult = calculate(project, "max");
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-symbol">
            <Beer size={24} />
          </div>
          <div>
            BAR<span> ESTIMATE</span>
            <small>Калькулятор франшизы</small>
          </div>
        </div>
        <nav aria-label="Основная навигация">
          {(
            [
              ["estimate", "Расчёт", Calculator],
              ["prices", "Прайс", FileSpreadsheet],
              ["projects", "Проекты", FolderOpen],
            ] as const
          ).map(([key, label, Icon]) => (
            <Button
              key={key}
              emphasis="ghost"
              className={view === key ? "nav-active" : ""}
              aria-pressed={view === key}
              onClick={() => setView(key)}
            >
              <Icon size={17} />
              {label}
              {key === "projects" && workspace.saved.length > 0 && (
                <span className="nav-count">{workspace.saved.length}</span>
              )}
            </Button>
          ))}
        </nav>
        <div className="header-right">
          <span className="offline">
            <HardDrive size={14} />
            {standalone ? "HTML · офлайн" : "Локальная версия"}
          </span>
          <Button onClick={openImport}>
            <ArrowUpFromLine size={16} />
            Загрузить данные
          </Button>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">ПИВНОЙ БАР / ИНВЕСТИЦИИ В ОТКРЫТИЕ</div>
            <h1>
              {view === "estimate"
                ? "Соберите стоимость объекта"
                : view === "prices"
                  ? "Актуальный прайс"
                  : "Сохранённые проекты"}
            </h1>
            <p>
              {view === "estimate"
                ? "От параметров помещения — к подробной смете открытия."
                : view === "prices"
                  ? "Все ставки из таблицы. Измените файл и загрузите обновлённую версию."
                  : "Снимки расчётов с собственными ценами. Доступны без интернета."}
            </p>
          </div>
          <Button emphasis="ghost" onClick={() => setDialog("help")}>
            <CircleHelp size={18} />
            Как считается
          </Button>
        </div>
        {standalone && (
          <div className="banner">
            Проекты сохраняются в этом браузере. Для переноса и резервной копии
            выгружайте JSON-копии. После перемещения HTML-файла или очистки
            данных браузера может потребоваться восстановление из копии.
          </div>
        )}
        {storageError && (
          <div className="banner error" role="alert">
            {storageError}
            <Button onClick={() => location.reload()}>Перезагрузить</Button>
          </div>
        )}
        {actionError && (
          <div className="banner error" role="alert">
            {actionError}
            <Button
              emphasis="ghost"
              aria-label="Скрыть ошибку действия"
              onClick={() => setActionError("")}
            >
              <X size={16} />
            </Button>
          </div>
        )}
        <div className="live-status" role="status" aria-live="polite">
          {notice}
        </div>
        {view === "projects" ? (
          <section className="panel projects-panel">
            <div className="panel-title">
              <h2>
                Проекты на этом компьютере <span>{workspace.saved.length}</span>
              </h2>
              <div className="actions">
                <Button onClick={() => restoreInput.current?.click()}>
                  <Archive size={16} />
                  Открыть JSON-копию
                </Button>
                <Button
                  intent="brand"
                  emphasis="solid"
                  onClick={() => setDialog("new")}
                >
                  <Plus size={16} />
                  Новый расчёт
                </Button>
              </div>
            </div>
            <p className="hint">
              Сохранённые сметы не меняются при загрузке нового прайса. Важные
              проекты храните также в JSON-копиях.
            </p>
            {workspace.saved.length === 0 ? (
              <div className="empty">
                <FolderOpen size={40} />
                <h3>Здесь будут ваши объекты</h3>
                <p>Настройте объект и нажмите «Сохранить проект» в расчёте.</p>
                <Button onClick={() => setView("estimate")}>
                  Перейти к расчёту
                </Button>
              </div>
            ) : (
              <div className="project-grid">
                {workspace.saved.map((p) => (
                  <article className="project-card" key={p.id}>
                    <div className="project-icon">
                      <Layers3 size={22} />
                    </div>
                    <h3>{p.name}</h3>
                    <p>
                      {p.params.area} м² · {kitchenNames[p.params.kitchen]} ·{" "}
                      {scenarioNames[p.params.scenario]}
                    </p>
                    <strong>{money(calculate(p).total)}</strong>
                    <small>
                      {new Date(p.updatedAt).toLocaleString("ru-RU", {
                        timeZone: "Europe/Moscow",
                      })}{" "}
                      МСК
                    </small>
                    <div className="actions">
                      <Button onClick={() => setPendingProject(p)}>
                        Открыть
                      </Button>
                      <Button
                        emphasis="ghost"
                        aria-label={`Выгрузить JSON-копию: ${p.name}`}
                        title="Выгрузить JSON-копию"
                        onClick={() => backup(p)}
                      >
                        <ArrowDownToLine size={17} />
                      </Button>
                      <Button
                        emphasis="ghost"
                        intent="danger"
                        aria-label={`Удалить проект: ${p.name}`}
                        title="Удалить проект"
                        disabled={storageBlocked || !valid}
                        onClick={() => setDeleteId(p.id)}
                      >
                        <Trash2 size={17} />
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className={`workspace ${view === "prices" ? "price-mode" : ""}`}>
            {view === "estimate" && (
              <aside className="configuration panel">
                <div className="panel-title">
                  <h2>
                    <SlidersHorizontal size={18} />
                    Параметры объекта
                  </h2>
                </div>
                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveProject();
                  }}
                >
                  <Field
                    label="Название объекта"
                    value={project.name}
                    maxLength={120}
                    onChange={(e) => change({ name: e.target.value })}
                    error={
                      !project.name.trim()
                        ? "Укажите название объекта."
                        : undefined
                    }
                  />
                  <div className="form-section">
                    <h3>Помещение</h3>
                    <Field
                      label="Площадь помещения"
                      value={project.params.area}
                      suffix="м²"
                      inputMode="decimal"
                      error={result.errors.area}
                      onChange={(e) => parameter("area", e.target.value)}
                    />
                    <div className="two-fields">
                      <Field
                        label="Посадочных мест"
                        value={project.params.seats}
                        inputMode="numeric"
                        error={result.errors.seats}
                        onChange={(e) => parameter("seats", e.target.value)}
                      />
                      <Field
                        label="Пивных кранов"
                        value={project.params.taps}
                        inputMode="numeric"
                        error={result.errors.taps}
                        onChange={(e) => parameter("taps", e.target.value)}
                      />
                    </div>
                    <Select
                      label="Формат кухни"
                      value={project.params.kitchen}
                      onChange={(e) =>
                        parameter("kitchen", e.target.value as Kitchen)
                      }
                    >
                      {Object.entries(kitchenNames).map(([key, value]) => (
                        <option value={key} key={key}>
                          {value}
                        </option>
                      ))}
                    </Select>
                    <p className="hint">
                      Мини-кухня включает оборудование и запасы для закусок.
                    </p>
                  </div>
                  <div className="form-section">
                    <h3>Ремонт и аренда</h3>
                    <div className="two-fields">
                      <Field
                        label="Ремонт, мес."
                        value={project.params.repair}
                        inputMode="decimal"
                        error={result.errors.repair}
                        onChange={(e) => parameter("repair", e.target.value)}
                      />
                      <Field
                        label="Каникулы, мес."
                        value={project.params.holidays}
                        inputMode="decimal"
                        error={result.errors.holidays}
                        onChange={(e) => parameter("holidays", e.target.value)}
                      />
                    </div>
                    <div className="subtle-note">
                      Оплачиваемая аренда:{" "}
                      <strong>
                        {Object.keys(result.errors).length
                          ? "—"
                          : num(
                              Math.max(
                                0,
                                Number(
                                  project.params.repair.replace(",", "."),
                                ) -
                                  Number(
                                    project.params.holidays.replace(",", "."),
                                  ),
                              ),
                            )}{" "}
                        мес.
                      </strong>
                    </div>
                  </div>
                  <div className="form-section">
                    <h3>Уровень цен</h3>
                    <div className="segmented" aria-label="Сценарий цен">
                      {Object.entries(scenarioNames).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={project.params.scenario === key}
                          className={
                            project.params.scenario === key ? "selected" : ""
                          }
                          onClick={() => parameter("scenario", key as Scenario)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="hint">
                      Ставки из колонок «Мин», «База» и «Макс». Ручные ставки
                      сохраняются.
                    </p>
                  </div>
                  <div className="local-save">
                    <HardDrive size={14} />
                    {persisted
                      ? "Черновик сохранён локально"
                      : valid
                        ? "Сохранение черновика…"
                        : "Есть незавершённые изменения"}
                  </div>
                  <Button className="full" onClick={() => setDialog("new")}>
                    <Plus size={16} />
                    Новый расчёт
                  </Button>
                </form>
              </aside>
            )}
            <section className="ledger panel">
              <div className="panel-title">
                <div>
                  <h2>
                    {view === "estimate"
                      ? "Смета открытия"
                      : "Справочник затрат"}
                  </h2>
                  <p className="hint">
                    {project.source} · {project.prices.length} позиций
                  </p>
                </div>
                <Button
                  emphasis="ghost"
                  busy={busy === "Шаблон прайса"}
                  disabled={Boolean(busy)}
                  onClick={() =>
                    action("Шаблон прайса", () => exportPrice(project))
                  }
                >
                  <ArrowDownToLine size={16} />
                  <span>
                    {view === "estimate" ? "Прайс" : "Скачать шаблон"}
                  </span>
                </Button>
              </div>
              {view === "estimate" && (
                <div className="cost-ribbon" aria-label="Структура бюджета">
                  {Object.entries(result.groups)
                    .filter(([, amount]) => amount > 0)
                    .map(([name, amount], i) => (
                      <div
                        key={name}
                        title={`${name}: ${money(amount)}`}
                        style={{ flex: amount, opacity: 1 - (i % 5) * 0.14 }}
                      />
                    ))}
                </div>
              )}
              <div className="filters">
                <div className="search">
                  <Search size={16} />
                  <input
                    ref={searchInput}
                    type="search"
                    aria-label="Поиск позиций"
                    placeholder="Найти статью затрат…"
                    value={draftQuery}
                    onCompositionStart={() => {
                      composing.current = true;
                    }}
                    onCompositionEnd={(e) => {
                      composing.current = false;
                      setQuery(e.currentTarget.value);
                    }}
                    onChange={(e) => {
                      setDraftQuery(e.target.value);
                      if (!composing.current) setQuery(e.target.value);
                    }}
                  />
                  {draftQuery && (
                    <button
                      type="button"
                      aria-label="Очистить поиск"
                      onClick={() => {
                        setQuery("");
                        setDraftQuery("");
                        searchInput.current?.focus();
                      }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <Select
                  label="Раздел сметы"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                >
                  <option>Все разделы</option>
                  {sections.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </div>
              {view === "estimate" && (
                <div className="ledger-meta">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={onlyIncluded}
                      onChange={(e) => setOnlyIncluded(e.target.checked)}
                    />
                    Только включённые
                  </label>
                  <span>
                    {result.includedCount} в расчёте из {project.prices.length}
                  </span>
                </div>
              )}
              {!result.valid && view === "estimate" && (
                <div className="banner error">
                  Расчёт приостановлен. Исправьте параметры или отмеченные
                  строки.
                </div>
              )}
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Таблица затрат с прокруткой"
              >
                <table>
                  <caption className="sr-only">
                    {view === "estimate"
                      ? "Детальная смета открытия"
                      : "Цены и условия применения позиций"}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="check-column">
                        {view === "estimate" ? "Вкл." : "ID"}
                      </th>
                      <th scope="col">Статья затрат</th>
                      {view === "estimate" ? (
                        <>
                          <th scope="col">Кол-во</th>
                          <th scope="col">Ставка</th>
                          <th scope="col" className="right">
                            Сумма, ₽
                          </th>
                        </>
                      ) : (
                        <>
                          <th scope="col" className="right">
                            Мин, ₽ / %
                          </th>
                          <th scope="col" className="right">
                            База, ₽ / %
                          </th>
                          <th scope="col" className="right">
                            Макс, ₽ / %
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((l, index) => (
                      <tr
                        key={l.row.id}
                        className={`${!l.included && view === "estimate" ? "excluded" : ""} ${l.error && l.included ? "row-error" : ""}`}
                      >
                        <td>
                          {view === "estimate" ? (
                            <input
                              type="checkbox"
                              aria-label={`Включить: ${l.row.name}`}
                              checked={l.included}
                              disabled={
                                !l.applicable || l.row.status === "Обязательно"
                              }
                              title={
                                !l.applicable
                                  ? "Не подходит выбранному формату кухни"
                                  : l.row.status === "Обязательно"
                                    ? "Обязательная статья"
                                    : "Включить в расчёт"
                              }
                              onChange={(e) =>
                                lineChange(
                                  l.row.id,
                                  "included",
                                  e.target.checked,
                                )
                              }
                            />
                          ) : (
                            <span className="row-id">{l.row.id}</span>
                          )}
                        </td>
                        <td className="description">
                          <div className="section-label">
                            {l.row.section} / {l.row.subsection}
                          </div>
                          <strong>{l.row.name}</strong>
                          <div className="row-tags">
                            <span>{l.row.status}</span>
                            {l.row.refundable && (
                              <span className="refundable">Возвратные</span>
                            )}
                            {!l.applicable && <span>Не применяется</span>}
                            {l.row.applies !== "Всегда" && (
                              <span>{l.row.applies}</span>
                            )}
                            {(l.override.rate !== undefined ||
                              l.override.quantity !== undefined) && (
                              <span className="manual">Ручная правка</span>
                            )}
                          </div>
                          {l.row.note && (
                            <small className="row-note">{l.row.note}</small>
                          )}
                          {l.error && (
                            <small
                              className="error-text"
                              id={`row-error-${index}`}
                            >
                              {l.error}
                            </small>
                          )}
                        </td>
                        {view === "estimate" ? (
                          <>
                            <td className="quantity-cell">
                              {l.row.basis === "%" ? (
                                <span className="hint">
                                  от суммы
                                  <br />
                                  выше
                                </span>
                              ) : (
                                <>
                                  <input
                                    aria-label={`Количество: ${l.row.name}`}
                                    aria-invalid={Boolean(l.error)}
                                    aria-describedby={
                                      l.error ? `row-error-${index}` : undefined
                                    }
                                    className="cell-input quantity"
                                    inputMode="decimal"
                                    disabled={!l.applicable}
                                    value={
                                      l.override.quantity ??
                                      (Number.isFinite(l.quantity)
                                        ? String(l.quantity)
                                        : "")
                                    }
                                    onChange={(e) =>
                                      lineChange(
                                        l.row.id,
                                        "quantity",
                                        e.target.value,
                                      )
                                    }
                                  />
                                  <small>{l.row.unit}</small>
                                </>
                              )}
                            </td>
                            <td className="rate-cell">
                              <input
                                aria-label={`Ставка: ${l.row.name}`}
                                aria-invalid={Boolean(l.error)}
                                aria-describedby={
                                  l.error ? `row-error-${index}` : undefined
                                }
                                className="cell-input rate"
                                inputMode="decimal"
                                disabled={!l.applicable}
                                value={l.override.rate ?? String(l.rate)}
                                onChange={(e) =>
                                  lineChange(l.row.id, "rate", e.target.value)
                                }
                              />
                              <small>
                                {l.row.basis === "%"
                                  ? "%"
                                  : "₽ / " + l.row.unit}
                              </small>
                              {(l.override.rate !== undefined ||
                                l.override.quantity !== undefined) && (
                                <button
                                  className="reset-line"
                                  aria-label={`Сбросить ручную правку: ${l.row.name}`}
                                  title="Вернуть ставку и количество из прайса"
                                  onClick={() => {
                                    const {
                                      rate: _r,
                                      quantity: _q,
                                      ...rest
                                    } = l.override;
                                    change({
                                      overrides: {
                                        ...project.overrides,
                                        [l.row.id]: rest,
                                      },
                                    });
                                  }}
                                >
                                  <RotateCcw size={13} />
                                </button>
                              )}
                            </td>
                            <td className="amount right">
                              {result.valid ? num(l.amount) : "—"}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="right number">{num(l.row.min)}</td>
                            <td className="right number price-base">
                              {num(l.row.base)}
                            </td>
                            <td className="right number">{num(l.row.max)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="empty">
                    <Search size={30} />
                    <h3>Ничего не найдено</h3>
                    <p>Измените запрос или выбранный раздел.</p>
                    <Button
                      onClick={() => {
                        setSection("Все разделы");
                        setOnlyIncluded(false);
                        setQuery("");
                        setDraftQuery("");
                      }}
                    >
                      Сбросить фильтры
                    </Button>
                  </div>
                )}
              </div>
              <footer className="table-footer">
                <span>
                  {filtered.length
                    ? `${safePage * 20 + 1}–${Math.min((safePage + 1) * 20, filtered.length)}`
                    : "0"}{" "}
                  из {filtered.length} позиций
                </span>
                <div className="actions">
                  <Button
                    emphasis="ghost"
                    aria-label="Предыдущая страница"
                    disabled={safePage === 0}
                    onClick={() => setPage(safePage - 1)}
                  >
                    <ChevronLeft size={18} />
                  </Button>
                  <span>
                    {safePage + 1} / {pages}
                  </span>
                  <Button
                    emphasis="ghost"
                    aria-label="Следующая страница"
                    disabled={safePage >= pages - 1}
                    onClick={() => setPage(safePage + 1)}
                  >
                    <ChevronRight size={18} />
                  </Button>
                </div>
              </footer>
            </section>
            {view === "estimate" && (
              <aside className="summary">
                <section className="summary-main panel">
                  <div className="eyebrow">БЮДЖЕТ ОТКРЫТИЯ</div>
                  <div className="total" aria-label="Бюджет открытия">
                    {result.valid ? (
                      <>
                        {num(result.total)}
                        <span>₽</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="summary-caption">
                    {scenarioNames[project.params.scenario]} ·{" "}
                    {kitchenNames[project.params.kitchen]}
                  </div>
                  <dl className="summary-details">
                    <div>
                      <dt>Статьи затрат</dt>
                      <dd>{result.valid ? money(result.subtotal) : "—"}</dd>
                    </div>
                    <div>
                      <dt>Резерв</dt>
                      <dd>{result.valid ? money(result.reserve) : "—"}</dd>
                    </div>
                  </dl>
                  <div className="refund-note">
                    <RotateCcw size={16} />
                    <div>
                      <strong>
                        {result.valid ? money(result.refundable) : "—"}
                      </strong>
                      <span>возвратные средства, уже в бюджете</span>
                    </div>
                  </div>
                  <div className="range">
                    <span>Диапазон по выбранным статьям</span>
                    <strong>
                      {result.valid
                        ? minResult.valid && maxResult.valid
                          ? `${money(minResult.total)} — ${money(maxResult.total)}`
                          : "Один из сценариев превышает лимит"
                        : "—"}
                    </strong>
                    <small>Ручные ставки фиксированы во всех сценариях.</small>
                  </div>
                  <Button
                    className="full"
                    intent="brand"
                    emphasis="solid"
                    disabled={!valid || storageBlocked}
                    onClick={saveProject}
                  >
                    <Save size={17} />
                    Сохранить проект
                  </Button>
                  <Button
                    className="full"
                    disabled={!valid || Boolean(busy)}
                    busy={busy === "Экспорт сметы"}
                    onClick={() =>
                      action("Экспорт сметы", () => exportEstimate(project))
                    }
                  >
                    <ArrowDownToLine size={17} />
                    Выгрузить смету XLSX
                  </Button>
                  <div className="summary-utilities">
                    <Button
                      emphasis="ghost"
                      disabled={!valid}
                      onClick={() => backup(project)}
                    >
                      <Archive size={15} />
                      JSON-копия
                    </Button>
                    <Button
                      emphasis="ghost"
                      disabled={!valid}
                      onClick={() => window.print()}
                    >
                      <Printer size={15} />
                      Печать
                    </Button>
                  </div>
                </section>
                <section className="breakdown panel">
                  <h2>Из чего складывается</h2>
                  {Object.entries(result.groups).map(([name, amount]) => (
                    <div className="breakdown-row" key={name}>
                      <div>
                        <span>{name}</span>
                        <strong>{result.valid ? money(amount) : "—"}</strong>
                      </div>
                      <div className="bar-track">
                        <div
                          style={{
                            width: `${result.total > 0 ? (amount / result.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </section>
                <p className="estimate-note">
                  Предварительная смета. Проверьте актуальность цен и объём
                  работ перед согласованием с клиентом.
                </p>
              </aside>
            )}
          </div>
        )}
        <footer className="app-footer">
          <span>
            <HardDrive size={13} />
            Данные остаются на вашем компьютере
          </span>
          <span>Bar Estimate · 1.0</span>
        </footer>
        <input
          ref={restoreInput}
          hidden
          type="file"
          accept=".json"
          aria-label="JSON-копия проекта"
          onChange={(e) => restoreFile(e.target.files?.[0])}
        />
        <div className="print-summary">
          <h2>{project.name}</h2>
          <p>
            {project.params.area} м² · {project.params.seats} мест ·{" "}
            {project.params.taps} кранов ·{" "}
            {kitchenNames[project.params.kitchen]}
          </p>
          <p>
            {project.source} · {scenarioNames[project.params.scenario]}
          </p>
          <table>
            <thead>
              <tr>
                <th>Статья</th>
                <th>Кол-во</th>
                <th>Ставка</th>
                <th>Сумма, ₽</th>
              </tr>
            </thead>
            <tbody>
              {result.lines
                .filter((l) => l.included)
                .map((l) => (
                  <tr key={l.row.id}>
                    <td>
                      {l.row.name}
                      {l.row.refundable ? " (возвратные)" : ""}
                    </td>
                    <td>
                      {l.row.basis === "%"
                        ? "от суммы выше"
                        : `${num(l.quantity)} ${l.row.unit}`}
                    </td>
                    <td>
                      {num(l.rate)}
                      {l.row.basis === "%" ? " %" : ""}
                    </td>
                    <td>{num(l.amount)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p>
            Итого: {money(result.total)}. В том числе резерв:{" "}
            {money(result.reserve)}. Возвратные: {money(result.refundable)}.
          </p>
          <p>
            Расчёт предварительный. Страховые взносы — ставка из прайса, не
            автоматическая формула от ФОТ.
          </p>
        </div>
      </main>
      {dialog === "import" && (
        <Modal title="Загрузить данные" wide onClose={closeImport}>
          <p>
            Загрузите актуальный прайс. Файл обрабатывается на вашем компьютере.
          </p>
          <button
            className="upload-zone"
            type="button"
            disabled={reading}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!reading) importFile(e.dataTransfer.files[0]);
            }}
          >
            <FileSpreadsheet size={34} />
            <strong>
              {reading
                ? "Читаем и проверяем таблицу…"
                : "Выберите файл или перетащите сюда"}
            </strong>
            <span>XLSX или CSV UTF-8 · до 5 МБ · до 2000 позиций</span>
          </button>
          <input
            hidden
            ref={fileInput}
            type="file"
            accept=".xlsx,.csv"
            aria-label="Выбрать прайс"
            onChange={(e) => importFile(e.target.files?.[0])}
          />
          <div className="import-status" role="status">
            {reading ? "Проверяем структуру, ставки и ID…" : fileName}
          </div>
          {importError && (
            <div className="banner error" role="alert">
              {importError}
            </div>
          )}
          {preview && (
            <div className="import-preview">
              <h3>
                <Check size={18} />
                Прайс прошёл проверку
              </h3>
              <p>
                {preview.length} позиций ·{" "}
                {new Set(preview.map((p) => p.section)).size} разделов
              </p>
              <ul>
                {preview.slice(0, 3).map((p) => (
                  <li key={p.id}>
                    {p.name}
                    <strong>
                      {money(p.base)}
                      {p.basis === "%" ? " / %" : ""}
                    </strong>
                  </li>
                ))}
              </ul>
              <div className="banner">
                Новый прайс заменит ставки текущего расчёта. Ручные количества,
                ставки и выбор опций будут сброшены. Параметры объекта и
                сохранённые проекты останутся.
              </div>
            </div>
          )}
          <div className="modal-actions">
            <Button onClick={closeImport}>Отмена</Button>
            <Button
              disabled={Boolean(busy)}
              onClick={() =>
                action("Шаблон прайса", () => exportPrice(project))
              }
            >
              <ArrowDownToLine size={16} />
              Скачать шаблон
            </Button>
            <Button
              intent="brand"
              emphasis="solid"
              disabled={!preview || reading}
              onClick={() => {
                if (!preview) return;
                change({ prices: preview, source: fileName, overrides: {} });
                setSection("Все разделы");
                closeImport();
                setNotice(
                  `Загружен прайс: ${fileName}. ${preview.length} позиций.`,
                );
              }}
            >
              Применить прайс
            </Button>
          </div>
        </Modal>
      )}
      {dialog === "help" && (
        <Modal
          title="Как считается стоимость"
          wide
          onClose={() => setDialog(null)}
        >
          <div className="help-content">
            <p>
              Каждая включённая строка — ставка × количество. У строки с базой
              «%» ставка применяется к сумме всех предыдущих включённых строк.
            </p>
            <dl>
              <dt>м²</dt>
              <dd>Площадь помещения</dd>
              <dt>место / кран</dt>
              <dd>Число посадочных мест / пивных кранов</dd>
              <dt>м²-мес</dt>
              <dd>
                Площадь × оплачиваемые месяцы ремонта. Каникулы вычитаются,
                результат не ниже нуля.
              </dd>
              <dt>комплект / шт</dt>
              <dd>Один комплект / количество из таблицы</dd>
            </dl>
            <h3>Включение статей</h3>
            <p>
              Обязательные статьи включены всегда, если подходят формату кухни.
              Рекомендуемые и «По ситуации» включены по умолчанию, опции
              выключены. Мини-кухня включает закуски.
            </p>
            <h3>Цены и ручные правки</h3>
            <p>
              Сценарий выбирает колонку Мин, База или Макс. Количество и ставку
              можно изменить в смете; ручная ставка остаётся одинаковой в трёх
              сценариях. Кнопка со стрелкой возле ставки возвращает значения
              прайса.
            </p>
            <p className="banner">
              Страховые взносы — готовая сумма из таблицы. Изменение ФОТ не
              меняет её автоматически: при необходимости измените эту строку
              вручную. Роялти и регулярные платежи сверх прайса не добавляются.
            </p>
            <h3>Возвратные средства</h3>
            <p>
              Помеченные в колонке «Возврат» суммы входят в бюджет открытия.
              Отдельный показатель — справочная часть бюджета, а не скидка.
            </p>
            <h3>Локальные данные</h3>
            {standalone && (
              <p>
                HTML-версия работает без установки, сервера и интернета.
                Сохранение привязано к браузеру и расположению файла.
                Используйте один и тот же браузер и храните HTML в постоянной
                папке. Приватный режим и ограничения браузера могут отключать
                сохранение; при этом можно выгрузить расчёт и JSON-копию.
              </p>
            )}
            <p>
              Черновик сохраняется на компьютере после корректного изменения.
              «Сохранить проект» создаёт снимок вместе с его прайсом. JSON-копия
              нужна для переноса или восстановления через раздел «Проекты». Не
              используйте название проекта для персональных данных клиента.
            </p>
            <p>
              При очистке профиля приложения локальные данные теряются.
              Регулярно выгружайте JSON-копии важных объектов.
            </p>
            <p className="hint">
              Места и краны задаются отдельно от площади. В листе контроля их
              количество не указано. При 20 местах суммы воспроизводятся с 8 /
              10 / 12 кранами для 50 / 65 / 80 м² соответственно; эти количества
              требуют подтверждения.
            </p>
          </div>
          <div className="modal-actions">
            <Button onClick={() => setDialog(null)}>Вернуться к расчёту</Button>
          </div>
        </Modal>
      )}
      {dialog === "new" && (
        <Modal title="Начать новый расчёт?" onClose={() => setDialog(null)}>
          <p>
            Текущий черновик будет заменён. Сохранённые проекты останутся. Если
            хотите сохранить этот расчёт, сначала закройте окно и нажмите
            «Сохранить проект» или выгрузите JSON-копию.
          </p>
          <div className="modal-actions">
            <Button autoFocus onClick={() => setDialog(null)}>
              Оставить текущий
            </Button>
            <Button
              intent="brand"
              emphasis="solid"
              onClick={() => {
                const fresh = newProject();
                fresh.prices = structuredClone(project.prices);
                fresh.source = project.source;
                setWorkspace((old) => ({ ...old, current: fresh }));
                setPersisted(false);
                setView("estimate");
                setDialog(null);
                setNotice("Новый расчёт создан с текущим прайсом.");
              }}
            >
              Начать новый
            </Button>
          </div>
        </Modal>
      )}
      {deleteId && (
        <Modal
          title="Удалить сохранённый проект?"
          onClose={() => setDeleteId(null)}
        >
          <p>
            Проект «{workspace.saved.find((p) => p.id === deleteId)?.name}»
            будет удалён из списка на этом компьютере. Восстановить его можно из
            ранее выгруженной JSON-копии. Открытый черновик останется.
          </p>
          <div className="modal-actions">
            <Button autoFocus onClick={() => setDeleteId(null)}>
              Оставить проект
            </Button>
            <Button
              intent="danger"
              emphasis="solid"
              onClick={() => {
                const next = {
                  ...workspace,
                  saved: workspace.saved.filter((p) => p.id !== deleteId),
                };
                try {
                  saveWorkspace(next);
                  setWorkspace(next);
                  setDeleteId(null);
                  setNotice("Сохранённый проект удалён.");
                } catch {
                  setActionError(
                    "Не удалось удалить проект из локального хранилища. Попробуйте ещё раз.",
                  );
                }
              }}
            >
              Удалить проект
            </Button>
          </div>
        </Modal>
      )}
      {pendingProject && (
        <Modal title="Открыть проект?" onClose={() => setPendingProject(null)}>
          <p>
            Проект «{pendingProject.name}» заменит текущий черновик вместе с его
            прайсом. Сохранённые проекты останутся. Для сохранения текущих
            правок отмените действие и сохраните проект или JSON-копию.
          </p>
          <div className="modal-actions">
            <Button autoFocus onClick={() => setPendingProject(null)}>
              Оставить текущий
            </Button>
            <Button
              intent="brand"
              emphasis="solid"
              onClick={() => {
                setWorkspace((old) => ({
                  ...old,
                  current: structuredClone(pendingProject),
                }));
                setPersisted(false);
                setView("estimate");
                setPendingProject(null);
                setNotice("Проект открыт со своим прайсом и ручными правками.");
              }}
            >
              Открыть вместо черновика
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
