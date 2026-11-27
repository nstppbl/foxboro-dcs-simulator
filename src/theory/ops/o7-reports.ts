import { iq, many, num, one, tf } from '../q'
import type { Module } from '../types'

const S = '2300v8 M6'

export const O7: Module = {
  id: 'o7',
  n: 7,
  course: 'ops',
  title: { ru: 'Стандартные и пользовательские отчёты (FoxSelect)', en: 'Standard and custom reports (FoxSelect)' },
  goal: {
    ru: 'Пользоваться FoxSelect: просмотр баз CP, поиск, включение и выключение compounds, и Process Summary Reports (Configure Report): 9 типов отчётов, фильтры, активация, удаление.',
    en: 'Use FoxSelect to browse CP databases, search, turn compounds on/off, and build Process Summary Reports (Configure Report): 9 report types, filters, activation, deletion.',
  },
  lessons: [
    {
      id: 'o7l1',
      title: { ru: 'FoxSelect и Process Summary Reports', en: 'FoxSelect and Process Summary Reports' },
      minutes: 25,
      base: `
### Напоминание
- **Compound** — набор блоков, выполняющих одну или несколько стратегий управления; живёт в CP; обычно в CP несколько compounds — это и есть база CP.
- **Block** — запрограммированный алгоритм для конкретной задачи; у каждого свой набор параметров.

### FoxSelect
Открыть: **File → FoxSelect** в FoxView. Опрашивает систему и показывает содержимое всех CP (и других станций управления) деревом: CP → compounds → блоки.
Функции:
- вызвать **faceplate overlay** блока;
- **включить / выключить compound** (Turn On / Turn Off);
- **искать** станцию, compound или блок;
- настроить **стандартный Process Summary Report**.
Полезно для сводки на начало смены: например, все текущие тревоги процесса по заводу или участку.

### Configure Report
Открыть: в FoxSelect **View → Configure Report**. Диалог со списком отчётов:
| Кнопка | Действие |
|---|---|
| **New** | новый отчёт (диалог NEW/EDIT/COPY) |
| **Edit** | изменить отчёт |
| **Activate** | отметить отчёт (чёрная галочка) — он строится по Refresh |
| **Deactivate** | снять отметку, вкладка в FoxSelect исчезает |
| **Delete** | удалить отчёт |
| **OK / Cancel** | сохранить / отменить изменения |

### 9 типов отчётов (в отчёте — **только один** тип)
**Уровень compound (3):**
1. **Off-scan** — compound не выполняется;
2. **In alarm** — есть активная тревога блока, подходящая под фильтр;
3. **Alarms inhibited** — хотя бы одна тревога подавлена на уровне compound.

**Уровень block (6):**
1. **Off-scan**;
2. **In alarm**;
3. **Alarms inhibited**;
4. **Not in control** — алгоритм блока не определяет выход, хотя блок в Auto (например, Hold/Track);
5. **In manual**;
6. **With bad I/O** — вход или выход в состоянии BAD.
(В некоторых версиях есть ещё «alarms disabled».)

### Создание отчёта
1. **New** → **Report Title** (обычно участок/продукт + тип, например ALL_CP_MANUAL).
2. Выбрать **тип отчёта**.
3. **Search Control Stations** — в каких CP искать (фильтры по именам).
4. **Alarm filters** — какие типы тревог учитывать (Select All или из списка Available → Selected).
5. **Save** (опция **Save Content** — сохранить как новый, как Save As).
6. В списке выбрать отчёт → **Activate** → в FoxSelect появится **вкладка** отчёта.
7. Вкладка сначала пустая — нажать **Refresh**: отчёт делает **снимок** состояния завода по фильтрам (колонки — из шаблона типа отчёта, например блок, compound, описание, приоритет).

Активных отчётов может быть несколько; управление — всё в Configure Report.
`,
      classic: `
### В I/A Series V8
Process Summary Reporter — часть FoxView/FoxSelect. Отчёты «Blocks in manual» и «Blocks with bad I/O» — стандартная проверка в начале смены и перед стартом партии.
`,
      modern: `
### В EcoStruxure Foxboro DCS
Аналоги — в Block Select Browser и отчётах Control HMI / Control Editors (поиск блоков по состоянию).
`,
      field: `
### Как говорят на объекте
- «Сними отчёт по **ручникам**» — blocks in manual.
- «Compound **офскан**» — compound выключен (off-scan).
- «Прогони **бэд-айо** отчёт перед стартом».
`,
      practice: [
        { label: 'Контроль: FoxSelect — найдите блок, откройте faceplate, выключите/включите compound', view: 'control', scenario: 'tank2' },
      ],
      quiz: [
        one('o7l1q1', 'Как открыть FoxSelect?', ['View → Configure Report', 'File → FoxSelect', 'Ctrl+E', 'Кнопка System'], 1, 'File → FoxSelect.', S),
        one('o7l1q2', 'Где открывается Configure Report?', ['File → Print', 'В FoxSelect: View → Configure Report', 'В FoxDraw', 'В System Manager'], 1, 'View → Configure Report.', S),
        num('o7l1q3', 'Сколько типов отчётов на уровне блоков (по курсу)?', 6, '3 для compound + 6 для блоков = 9.', S),
        tf('o7l1q4', 'В один отчёт можно включить несколько типов (например, in manual и bad I/O).', false, 'Только один тип на отчёт.', S),
        one('o7l1q5', 'Блок в Auto, но выход не определяется алгоритмом. Какой тип отчёта его покажет?', ['In manual', 'Not in control', 'Off-scan', 'Alarms inhibited'], 1, 'Not in control.', S),
        many('o7l1q6', 'Что умеет FoxSelect?', ['Открыть faceplate блока', 'Включить/выключить compound', 'Искать станцию, compound, блок', 'Настроить Process Summary Report', 'Менять letterbug CP'], [0, 1, 2, 3], 'Letterbug — не через FoxSelect.', S),
        one('o7l1q7', 'После активации вкладка отчёта пустая. Что сделать?', ['Перезапустить FoxView', 'Нажать Refresh', 'Удалить отчёт', 'Сменить окружение'], 1, 'Refresh делает снимок по фильтрам.', S),
      ],
      interview: [
        iq(
          'o7l1i1',
          'Перед стартом партии нужно убедиться, что оборудование готово. Какие проверки в DCS?',
          [
            ['Отчёт blocks in manual', 'manual'],
            ['Отчёт bad I/O', 'bad'],
            ['Нет подавленных (inhibited) тревог / compounds off-scan', 'inhibit', 'off-scan'],
            ['Нет активных системных тревог', 'системн', 'system'],
          ],
          'Я бы снял в FoxSelect Process Summary отчёты по участку: blocks in manual (всё должно быть в Auto, как требует рецепт), blocks with bad I/O, compounds off-scan и тревоги, которые inhibited. Плюс проверить, что нет активных системных тревог в System Manager по CP и FBM этого оборудования. В фарме такие проверки часто входят в pre-batch checklist или в permissives фазы.',
        ),
      ],
    },
  ],
}
