# UX contract

## Business evidence

The user requests an offline Windows 10/11 calculator with spreadsheet import. The supplied workbook `2026-10-28-прайс-франшиза-пивной-бар.xlsx`, sheets «Справочник затрат», «Как заполнять» and «Проверка», defines quantity bases, price scenarios, applicability, default inclusion, refundable markers and sequential percentage reserves. `PRODUCT.md` records interpretations and limitations. No payment, account, external transmission or legal assurance is involved.

## Canonical UI Map

| Capability      | Canonical owner                           | Source of truth | Allowed variants                                                                                | Verification               |
| --------------- | ----------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------- | -------------------------- |
| Form            | src/ui.tsx Field, src/model.ts validation | UX-CONTRACT.md  | Real labels, inline errors, noValidate, preserve invalid text; invalid draft blocks export/save | Browser validation flow    |
| Select/Listbox  | src/ui.tsx Select                         | UX-CONTRACT.md  | Native; Windows-owned popup geometry and keyboard accepted                                      | Browser selection/keyboard |
| Scrollbar       | src/style.css                             | UX-CONTRACT.md  | Global inherited tokens, standard and WebKit, forced-colors                                     | Browser computed style     |
| Toast           | src/App.tsx notice                        | UX-CONTRACT.md  | One persistent localized polite live region; failures remain inline                             | Browser save/import        |
| CRUD            | src/storage.ts and App                    | UX-CONTRACT.md  | Snapshot project, local only; saved projects never silently reprice                             | Browser save/open/reload   |
| Table Selection | src/App.tsx ledger                        | UX-CONTRACT.md  | Per-item inclusion; mandatory applicable rows cannot be excluded; no bulk selection             | Unit + browser             |
| Dialog          | src/ui.tsx Modal                          | UX-CONTRACT.md  | Native dialog inert/focus trap/Escape; trigger focus restoration                                | Browser keyboard           |

## State and flow ledger

- Parameters are transient draft strings validated before calculation. Invalid values show an error, totals are marked unavailable, export and save are disabled. No coercion of an empty value to zero.
- Automatic quantities recalculate from parameters unless a line has an explicit quantity override; show overrides and allow restoring defaults.
- Optional rows start off. Other statuses start on. Applicability always wins over a manual selection. Mini-kitchen includes snack rows (confirmed by control sums).
- Current workspace autosaves locally, with visible persistence failure; projects are explicit named snapshots including prices and overrides. Names are object aliases, not requested personal data. No cloud sync. User can export a JSON backup and restore it. A single desktop instance owns editing; browser storage changes block autosave until reload to avoid lost updates.
- Import parsing is asynchronous and cancellable by discarding its result; no draft data changes until valid preview is applied in app-owned confirmation. Applying prices resets line overrides and selections, retains object parameters and saved projects. Failed import keeps existing data and allows another file. Max 5MB, 2000 rows, no spreadsheet formulas; duplicated IDs rejected.
- Local-only filters/query/page persist in component state, never URL (file:// desktop, object names are private/nonshareable). Local search immediate, IME commits only. 20 rows per page; filter changes reset page, range is visible. No network request race.
- Remove saved snapshot uses app-owned confirmation naming the project. New draft uses confirmation; saved snapshots remain. Export downloads XLSX with detail and summary. Print uses print CSS. JSON restore validates the complete snapshot before replacing current draft, leaves other saved projects intact.
- Locale ru-RU / RUB; timestamps Europe/Moscow, label МСК. Round monetary line amounts to kopecks with decimal arithmetic, sum rounded lines. Sequential reserve uses prior included amounts. No invented tax or recurring royalty calculations.

## Автономный HTML

`Bar-Estimate.html` генерируется из тех же `src/App.tsx`, shared primitives и CSS. Денежные правила и владельцы компонентов одинаковы. HTML использует встроенный classic script без module imports или fetch, поэтому не требует сервера. Браузерное хранилище привязано к браузеру/профилю/расположению файла; предупреждение постоянно видно. JSON-копии — поддерживаемый перенос между браузерами и файлами. При недоступном localStorage расчёт и экспорт продолжают работать с существующим предупреждением; сохранение проектов блокируется. Проверки: `npm run test:html`.
