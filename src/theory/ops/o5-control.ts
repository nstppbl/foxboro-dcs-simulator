import { iq, many, one, tf } from '../q'
import type { Module } from '../types'

const S = '2300v8 M4'

export const O5: Module = {
  id: 'o5',
  n: 5,
  course: 'ops',
  title: { ru: 'Управление типовым процессом', en: 'Controlling a typical process' },
  goal: {
    ru: 'Управлять процессом через faceplates и мнемосхемы: дискретные устройства (запрос и факт), индикаторы и регуляторы, режимы Auto/Manual, Local/Remote, Hold/Track, group и scratchpad group displays.',
    en: 'Control the process with faceplates and graphics: discrete devices (requested vs actual), indicators and controllers, Auto/Manual, Local/Remote, Hold/Track, group and scratchpad group displays.',
  },
  lessons: [
    {
      id: 'o5l1',
      title: { ru: 'Контур регулирования, faceplates и режимы', en: 'Control loop, faceplates and modes' },
      minutes: 25,
      base: `
### Типовой контур
Поле → **трансмиттер** → **FBM** (I/O) → **CP**: блок **AIN** → регулятор **PID** → **AOUT** → FBM → **клапан** → процесс.
- **Measurement (MEAS)** — измеренное значение (PV);
- **Setpoint (SP, SPT)** — желаемое значение;
- **Output (OUT)** — сигнал на исполнительный механизм, обычно в %.

### Имена: compound и block
На faceplate видно **имя compound** и **имя блока** (например, TIC102 → блок PID). Связь: **COMPOUND:BLOCK.PARAMETER**. Правила имён — до 12 символов; compound уникален в сети, блок — внутри compound.

### Дискретные устройства
Два состояния: мотор **работает/стоит**, соленоидный клапан **открыт/закрыт**. Оператор различает:
- **запрошенное состояние** — цвет кнопок: **START зелёная** при выборе, **STOP красная**;
- **фактическое состояние** — по обратной связи: **зелёный — RUNNING/OPEN**, **красный — STOPPED/CLOSED**.
Если запрос и факт разошлись дольше заданного времени — State-тревога (рассогласование).

### Faceplate индикатора
Значение и единицы, бар измерения, пределы тревог (треугольники H/L, линии HH/LL), поле тревоги. **Indicator overlay** — увеличенный вариант с деталями.

### Faceplate регулятора
| Элемент | Что показывает |
|---|---|
| Описание, compound, блок | что это за контур |
| **Block state** | **AUTO / MANUAL**, **HOLD**, **TRACK** |
| **Setpoint selection** | **LOCAL / REMOTE** |
| Бары | синий — измерение, белый — выход; треугольники выхода — **clamps** (ограничения), линии — пределы тревог выхода |
| Значения | MEAS с единицами, SP, OUT с единицами |

**Режимы**
- **Auto** — выход считает PID по SP и MEAS; оператор меняет **SP**.
- **Manual** — оператор задаёт **OUT** напрямую (пуск, неисправный датчик, проверка клапана).
- **Local** — SP задаёт оператор; **Remote** — SP приходит от другого блока (каскад, ratio, последовательность).
- **Hold** — выход заморожен (например, при **BAD** измерении); снимается переводом в Manual.
- **Track** — выход следует за внешним сигналом (вторичный каскада в Manual, блокировка).

### Работа с регулятором в FoxView
1. Выбрать faceplate (на group display или из мнемосхемы).
2. Для Auto/Manual и Local/Remote — кнопки режимов на faceplate.
3. Изменение SP (в Auto+Local) или OUT (в Manual) — поле значения или стрелки (**station operation / output operation**).

### Group displays
Группа из нескольких faceplates (обычно 8). **Scratchpad group displays** оператор собирает сам «на лету» из нужных блоков (меню Scratchpad), без FoxDraw.
`,
      classic: `
### В I/A Series V8
Режимы — параметры блока PID: **MA** (Manual/Auto), **LR** (Local/Remote), переключатели **MANSW/AUTSW** (MANSW сильнее) и **LOCSW/REMSW** (LOCSW сильнее), **INITMA/INITLR** — режим после старта. Hold/Track видны в статусе блока.
`,
      modern: `
### В EcoStruxure Foxboro DCS
Faceplates Control HMI повторяют логику: режимы, SP, OUT, тревоги. Параметры блоков те же.
`,
      field: `
### Как говорят на объекте
- «Переведи в **ручник**» — Manual.
- «Регулятор в **ремоте**, SP идёт от мастера».
- «Висит в **холде**, датчик бэд».
- «**Скретчпад**-группу собери с этими пятью контурами».
`,
      practice: [
        { label: 'Бак: регулятор уровня — Auto/Manual, SP, OUT', view: 'operator', scenario: 'tank' },
        { label: 'Теплообменник: каскад, Remote SP', view: 'operator', scenario: 'hex' },
        { label: 'Расход: group display и faceplate', view: 'operator', scenario: 'flow' },
      ],
      quiz: [
        one('o5l1q1', 'В каком режиме оператор задаёт выход регулятора напрямую?', ['Auto', 'Manual', 'Remote', 'Track'], 1, 'Manual — OUT от оператора.', S),
        one('o5l1q2', 'Регулятор в Remote. Откуда приходит SP?', ['От оператора', 'От другого блока (каскад, последовательность)', 'Из Historian', 'Всегда 0'], 1, 'Remote — внешний SP.', S),
        one('o5l1q3', 'Что делает регулятор при BAD измерении и как это обойти?', ['Уходит в Auto; ничего', 'Hold, выход заморожен; перевести в Manual', 'Track; перевести в Remote', 'Выход 100 %; перезапустить CP'], 1, 'Hold; обход — Manual.', S),
        tf('o5l1q4', 'Цвет кнопки START показывает фактическое состояние насоса.', false, 'Кнопки — запрос; факт — по обратной связи (RUNNING/STOPPED).', S),
        many('o5l1q5', 'Что есть на faceplate регулятора?', ['Имя compound и блока', 'MEAS, SP, OUT', 'Auto/Manual, Local/Remote', 'Clamps выхода', 'Пароль окружения'], [0, 1, 2, 3], 'Пароля на faceplate нет.', S),
        one('o5l1q6', 'Чем scratchpad group display отличается от обычного?', ['Ничем', 'Оператор собирает его сам на лету, без FoxDraw', 'Только для инженеров', 'Показывает тренды'], 1, 'Собирается из меню Scratchpad.', S),
      ],
      interview: [
        iq(
          'o5l1i1',
          'Когда оператор переводит контур в Manual и что должно быть при возврате в Auto?',
          [
            ['Пуск, неисправный датчик, проверка клапана, нестабильный контур', 'датчик', 'пуск'],
            ['Безударный переход (SP tracking / BCALC)', 'безудар', 'bumpless'],
            ['В Manual контур не регулирует — нужен контроль оператора', 'контрол'],
            ['Записи/audit trail о смене режима', 'audit', 'журнал'],
          ],
          'В Manual переводят при пуске установки, при неисправном датчике (BAD), для проверки клапана или когда контур раскачался. В Manual регулирования нет, процесс держит оператор, поэтому нужен постоянный контроль. Возврат в Auto должен быть безударным (bumpless): SP следит за измерением в Manual (PV tracking), а интегратор инициализируется через BCALCI/BCALCO. Смена режима записывается в журнал событий (audit trail).',
        ),
      ],
    },
  ],
}
