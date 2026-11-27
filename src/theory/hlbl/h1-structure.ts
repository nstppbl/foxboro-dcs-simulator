import { iq, many, one, tf } from '../q'
import type { Module } from '../types'

const S = 'HLBL (B0400DF)'

export const H1: Module = {
  id: 'h1',
  n: 1,
  course: 'hlbl',
  title: { ru: 'Программа HLBL: структура и данные', en: 'The HLBL program: structure and data' },
  goal: {
    ru: 'Знать, как устроена программа HLBL: заголовок, секции CONSTANTS, VARIABLES, USER_LABELS, STATEMENTS, типы данных, ссылки на параметры блоков и собственные параметры блока (BI0001, RI0001…).',
    en: 'Know how an HLBL program is laid out: header, CONSTANTS, VARIABLES, USER_LABELS, STATEMENTS sections, data types, references to block parameters and the block’s own parameters (BI0001, RI0001…).',
  },
  lessons: [
    {
      id: 'h1l1',
      title: { ru: 'Где живёт HLBL и как выглядит программа', en: 'Where HLBL lives and what a program looks like' },
      minutes: 20,
      base: `
**HLBL** (High Level Batch Language) — язык программ **блоков последовательностей** Foxboro: IND, DEP, EXC (и MON со своей логикой условий). Программа хранится в блоке, **компилируется** при загрузке конфигурации и выполняется в **CP** вместе с непрерывными блоками. Последовательность не регулирует сама — она **командует** блоками: режимы Auto/Manual, задания, клапаны, ожидание условий, сообщения оператору.

> Руководство: **HLBL User's Guide (B0400DF)**. Синтаксис ниже проверен по реальным программам; детали своей версии всегда сверяйте с руководством.

### Скелет программы
\`\`\`
INDEPENDENT_SEQUENCE
{ комментарий в фигурных скобках:
  назначение, автор, версия, номер изменения }

CONSTANTS
  TMAX = 900 ;
  BADVAL = -99999.0 ;

VARIABLES
  T     : I ;          { целое }
  TEMP0 : R ;          { вещественное }
  HIST  : R[60] ;      { массив }

USER_LABELS
  VOL_SP : RI0001 ;    { собственный параметр блока }
  RESET  : BI0001 ;
  PHASE  : IO0001 ;

STATEMENTS
  <<START>>
  T := 0 ;
  ...
ENDSEQUENCE
\`\`\`

### Секции
| Секция | Зачем |
|---|---|
| **заголовок** | тип последовательности: **INDEPENDENT_SEQUENCE** (блок IND), **DEPENDENT_SEQUENCE** (DEP), **EXCEPTION_SEQUENCE** (EXC) |
| **CONSTANTS** | именованные константы: \`TMAX = 900 ;\` — никаких «магических чисел» в коде |
| **VARIABLES** | локальные переменные программы с типом: \`T : I ;\`, \`X : R ;\`, массивы \`R[60]\` |
| **USER_LABELS** | **понятные имена** для параметров: \`VOL_SP : RI0001 ;\` — дальше в коде пишут VOL_SP |
| **STATEMENTS** | собственно операторы, до **ENDSEQUENCE** |

Комментарии — в **{ фигурных скобках}**, могут занимать несколько строк. Операторы заканчиваются **;**.

### Типы данных (основные)
- **R** — вещественное (real), **I** — целое (integer), булевы значения **TRUE / FALSE**, строки для сообщений;
- массивы: \`VALUES : R[1440] ;\`, обращение \`VALUES[I]\`;
- арифметика \`+ - * /\`, целочисленные **DIV** и **MOD**, сравнения \`= <> < > <= >=\`, логика **AND OR NOT**.

### Тренажёр
В тренажёре можно писать **в полном формате** (как выше) или коротко — только операторы, по одному на строку, с комментариями \`--\`. Полный формат используется в лабе 4 (COOL).
`,
      classic: `
### В I/A Series V8
Блок IND/DEP/EXC создают в IACC/ICC как любой блок; исходный текст HLBL редактируют в редакторе последовательностей и **компилируют** при validate/download. Ошибка компиляции — блок не загрузится.
`,
      modern: `
### В EcoStruxure Foxboro DCS
HLBL-редактор в Control Editors; для тех же блоков есть **SFC-редактор** (шаги и переходы). Язык и параметры блоков те же.
`,
      field: `
### Как говорят на объекте
- «Шапка последовательности» — заголовок и комментарий с версией.
- «**Юзер-лейблы**» — USER_LABELS.
- «Последовательность **не компилится**» — ошибка синтаксиса при download.
`,
      practice: [
        { label: 'Лаба 4: фаза COOL в полном формате программы', view: 'curriculum', lab: 'h4-cool' },
        { label: 'R-401: откройте блок PHASES и посмотрите исходный код', view: 'control', scenario: 'batch' },
      ],
      quiz: [
        one('h1l1q1', 'В какой секции пишут исполняемые операторы?', ['CONSTANTS', 'VARIABLES', 'USER_LABELS', 'STATEMENTS'], 3, 'STATEMENTS … ENDSEQUENCE.', S),
        one('h1l1q2', 'Как пишут комментарий в HLBL?', ['// текст', '# текст', '{ текст }', '/* текст */'], 2, 'Фигурные скобки; могут быть многострочными.', S),
        one('h1l1q3', 'Зачем USER_LABELS?', ['Объявить таймеры', 'Дать понятные имена параметрам (VOL_SP : RI0001)', 'Задать период блока', 'Подключить FBM'], 1, 'Код читается по смыслу, а не по RI0001.', S),
        one('h1l1q4', 'Каким заголовком начинается программа блока DEP?', ['INDEPENDENT_SEQUENCE', 'DEPENDENT_SEQUENCE', 'EXCEPTION_SEQUENCE', 'BEGIN'], 1, 'DEPENDENT_SEQUENCE.', S),
        tf('h1l1q5', 'Программа HLBL выполняется в рабочей станции, а не в CP.', false, 'В CP, вместе с непрерывными блоками.', S),
        many('h1l1q6', 'Что объявляют в VARIABLES?', ['T : I ;', 'X : R ;', 'HIST : R[60] ;', 'TMAX = 900 ;'], [0, 1, 2], 'TMAX = 900 — константа (CONSTANTS).', S),
      ],
    },
    {
      id: 'h1l2',
      title: { ru: 'Параметры блока последовательности и ссылки', en: 'Sequence block parameters and references' },
      minutes: 20,
      base: `
### Собственные параметры блока
У блоков последовательностей есть набор **пользовательских параметров**, через которые программа общается с миром:
| Параметры | Тип | Направление |
|---|---|---|
| **BI0001, BI0002 …** | булевы | входы |
| **BO0001 …** | булевы | выходы |
| **II0001 …** / **IO0001 …** | целые | входы / выходы |
| **RI0001 …** / **RO0001 …** | вещественные | входы / выходы |
| **SN…** | строковые | (зависит от версии) |
Входы (**I**) можно **связать** с выходами других блоков в конфигурации (например, RI0001 ← RECIPE.RO01), выходы (**O**) другие блоки читают. Точное количество каждого вида — в описании блока для вашей версии.

Хорошая практика: **USER_LABELS** даёт этим параметрам имена (\`VOL_SP : RI0001 ;\`), а конфигурация связывает их с нужными блоками. Тогда код не зависит от имён чужих блоков, а связи видны в конфигурации и проверяются на validate.

### Ссылки на параметры других блоков
- **:BLOCK.PARAM** — блок в **своём** compound;
- **COMPOUND:BLOCK.PARAM** — блок в другом compound (в коде HLBL часто пишут с префиксом **::**, например ::REACTOR:TIC401.SPT — сверяйте с B0400DF).
Можно читать (условия, ожидание) и писать (задания, режимы, выходы).

### Качество сигнала
У значения можно проверить статус, например **.BAD**:
\`\`\`
IF INPUT.BAD THEN
  ...
ENDIF ;
\`\`\`
Это важно: решение по плохому сигналу — частая причина ошибок последовательности (датчик BAD, а фаза ждёт «температура ≥ 60»).

### Стандартные параметры блока (что видит инженер и оператор)
- **ACTIVE** — запуск/останов программы;
- **MA** — Auto/Manual последовательности (в Manual оператор может выполнять по шагам — зависит от версии);
- **PERIOD / PHASE** — как часто выполняется блок;
- номер выполняемого оператора (в тренажёре — **STMNO**) и **код ошибки** — главные инструменты отладки.

### Тренажёр
В тренажёре HLBL-блок не имеет параметров BI0001/RI0001; USER_LABELS там могут указывать **прямо на C:B.P** (\`TEMP : REACTOR:TT401.PNT ;\`). Ссылки с **::** тоже принимаются.
`,
      classic: `
### В I/A Series V8
Связи пользовательских параметров (RI0001 ← :RECIPE.RO01) задаются в ICC/IACC как у любого блока. Так рецепт передаётся в фазу.
`,
      modern: `
### В EcoStruxure Foxboro DCS
То же в Control Editors; параметры блоков последовательностей одинаковые.
`,
      field: `
### Как говорят на объекте
- «Рецептурный параметр заходит в **RI0003**».
- «Проверь **.BAD** перед сравнением».
`,
      practice: [
        { label: 'R-401: рецепт RECIPE.RI01…RI04 и блок PHASES', view: 'control', scenario: 'batch' },
        { label: 'Лаба 1: CHARGE_A с параметрами рецепта', view: 'curriculum', lab: 'h1-charge' },
      ],
      quiz: [
        one('h1l2q1', 'Какой параметр — вещественный вход блока последовательности?', ['BI0001', 'RO0001', 'RI0001', 'IO0001'], 2, 'R — real, I — input.', S),
        one('h1l2q2', 'Что значит ссылка :LV100.MA?', ['Параметр MA блока LV100 в своём compound', 'Блок LV100 в другом CP', 'Переменную MA', 'Ошибку синтаксиса'], 0, 'Двоеточие без compound — свой compound.', S),
        tf('h1l2q3', 'Перед сравнением аналогового значения в условии стоит проверять его статус (.BAD).', true, 'Иначе фаза примет решение по плохому сигналу.', S),
        one('h1l2q4', 'Почему лучше читать рецепт через RI0001 + связь в конфигурации, а не прямой ссылкой в коде?', ['Быстрее выполняется', 'Связи видны и проверяются в конфигурации, код не зависит от чужих имён', 'Так требует Windows', 'Нет разницы'], 1, 'Ссылки валидируются, код переносим.', S),
        one('h1l2q5', 'Какой параметр запускает программу?', ['MA', 'ACTIVE', 'PERIOD', 'BI0001'], 1, 'ACTIVE.', S),
      ],
      interview: [
        iq(
          'h1l2i1',
          'How do you pass recipe parameters into an HLBL phase?',
          [
            ['Use the block’s own input parameters RI/II/BI', 'ri0001', 'ri'],
            ['Connect them in the configuration to the recipe source', 'connect', 'configuration'],
            ['Name them with USER_LABELS', 'user_labels', 'label'],
            ['Validate limits before use (range, BAD)', 'validate', 'limit'],
          ],
          'The phase block has its own user input parameters, for example RI0001 for volume and RI0003 for temperature. In the configuration I connect them to the recipe source (a recipe block or a batch manager). In the program USER_LABELS gives them names like VOL_SP : RI0001, so the code reads clearly. Before using a value the phase should validate it: within limits, not BAD; otherwise it refuses to start and tells the operator.',
        ),
      ],
    },
  ],
}
