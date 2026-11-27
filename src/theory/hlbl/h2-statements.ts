import { iq, many, one, tf } from '../q'
import type { Module } from '../types'

const S = 'HLBL (B0400DF)'

export const H2: Module = {
  id: 'h2',
  n: 2,
  course: 'hlbl',
  title: { ru: 'Операторы: решения, циклы, ожидание, сообщения', en: 'Statements: decisions, loops, waits, messages' },
  goal: {
    ru: 'Писать логику HLBL: присваивание, IF/ELSE, WHILE, метки и GOTO, WAIT и WAIT UNTIL, сообщения оператору, EXIT; понимать, как программа «спит» между сканами и делать ожидания с тайм-аутом.',
    en: 'Write HLBL logic: assignment, IF/ELSE, WHILE, labels and GOTO, WAIT and WAIT UNTIL, operator messages, EXIT; understand how the program sleeps between scans and build waits with timeouts.',
  },
  lessons: [
    {
      id: 'h2l1',
      title: { ru: 'Присваивание, IF, WHILE, метки и GOTO', en: 'Assignment, IF, WHILE, labels and GOTO' },
      minutes: 20,
      base: `
### Присваивание
\`\`\`
T := 0 ;
::REACTOR:TIC401.SPT := TR ;      { записать задание регулятору }
::REACTOR:FIC404.MA := TRUE ;     { регулятор в Auto }
VOL := ::REACTOR:FQ404.RO01 ;     { прочитать сумматор }
\`\`\`
Запись в параметр другого блока возможна, только если параметр **settable** и **не secured** (не связан). Например, SPT регулятора в **Remote** берётся из связи — писать надо в источник или перевести регулятор в Local.

### IF
\`\`\`
IF ::REACTOR:LT401.PNT > 20 THEN
  SENDMSG "R-401 NOT EMPTY" ;
  EXIT ;
ELSE_IF ::REACTOR:PT403.PNT > 1.5 THEN
  SENDMSG "R-401 PRESSURISED" ;
  EXIT ;
ELSE
  SENDMSG "PERMISSIVES OK" ;
ENDIF ;
\`\`\`
Вложенный IF внутри ELSE тоже допустим (\`ELSE IF … ENDIF; ENDIF;\`). Ключевое слово ELSE_IF есть не во всех описаниях — сверяйте с версией.

### WHILE
\`\`\`
T := 0 ;
WHILE T < HOLDT DO
  WAIT 1 ;
  T := T + 1 ;
ENDWHILE ;
\`\`\`
**Каждый цикл, который ждёт процесс, должен содержать WAIT.** Цикл без WAIT крутится внутри одного скана, CP прерывает выполнение блока (ошибка выполнения) — это классическая ошибка новичков.

### Метки и GOTO
\`\`\`
<<INIT>>
SUM := 0 ;  N := 0 ;
<<LOOP>>
WAIT 0.5 ;
IF RESET THEN GOTO INIT ; ENDIF ;
...
GOTO LOOP ;
\`\`\`
Метки **<<ИМЯ>>** часто ставят на начало **шагов фазы** (\`<<CHARGE>>\`, \`<<HEAT>>\`): по ним видно, где стоит программа, и на них переходят при restart. Вечный цикл с GOTO — типовой шаблон для **IND**, который считает/следит постоянно (например, скользящее среднее раз в 0,5 с).

### Тренажёр
Принимает IF/ELSE_IF/ELSE/ENDIF, WHILE/ENDWHILE, <<метки>> и GOTO, по одному оператору на строку.
`,
      classic: `
### В I/A Series V8
Тот же синтаксис в редакторе IACC/ICC; при компиляции ошибки показываются с номером строки.
`,
      modern: `
### В EcoStruxure Foxboro DCS
То же в Control Editors. Альтернатива для наглядности — SFC (шаги/переходы).
`,
      field: `
### Как говорят на объекте
- «Цикл **без вейта** — блок вылетел с ошибкой».
- «Прыгни на метку **<<HEAT>>** при рестарте».
`,
      practice: [
        { label: 'Лаба 2: DISCHARGE с тайм-аутом (WHILE + счётчик)', view: 'curriculum', lab: 'h2-discharge' },
        { label: 'Лаба 3: HEAT с проверкой мешалки', view: 'curriculum', lab: 'h3-heat' },
      ],
      quiz: [
        one('h2l1q1', 'Что не так с этим циклом?', ['Нет ENDIF', 'Нет WAIT внутри цикла — он крутится в одном скане', 'Нельзя сравнивать с 70', 'Всё правильно'], 1, 'Цикл ожидания процесса должен содержать WAIT.', S, 'WHILE ::REACTOR:TT401.PNT < 70 DO\n  T := T + 1 ;\nENDWHILE ;'),
        one('h2l1q2', 'Регулятор TIC402 в Remote (SPT связан с TIC401.OUT). Программа пишет ::REACTOR:TIC402.SPT := 50. Что будет?', ['SP станет 50', 'Запись не пройдёт или будет перезаписана — параметр связан (secured)', 'TIC402 перейдёт в Manual', 'CP перезагрузится'], 1, 'Писать надо в источник (TIC401) или перевести в Local.', S),
        one('h2l1q3', 'Как в HLBL обозначают метку шага?', ['LABEL HEAT:', '<<HEAT>>', '#HEAT', '[HEAT]'], 1, '<<ИМЯ>>, переход — GOTO ИМЯ.', S),
        tf('h2l1q4', 'IND-блок с вечным циклом GOTO LOOP и WAIT 0.5 — допустимый шаблон для постоянного расчёта.', true, 'Типовой шаблон (например, скользящее среднее).', S),
        many('h2l1q5', 'Что нужно для записи в параметр другого блока из HLBL?', ['Параметр settable', 'Параметр не связан (не secured)', 'Блок в том же CP обязательно', 'Блок типа PID обязательно'], [0, 1], 'Можно писать и в другие CP через сеть, тип блока любой.', S),
      ],
    },
    {
      id: 'h2l2',
      title: { ru: 'WAIT, WAIT UNTIL, тайм-ауты и сообщения', en: 'WAIT, WAIT UNTIL, timeouts and messages' },
      minutes: 20,
      base: `
### Как программа «спит»
Блок последовательности выполняется каждый скан CP. Дойдя до **WAIT** или невыполненного **WAIT UNTIL**, программа **приостанавливается** и продолжает с того же места на следующих сканах. Остальные блоки CP при этом работают как обычно.

\`\`\`
WAIT 5 ;                                   { пауза 5 с }
WAIT UNTIL ::REACTOR:TT401.PNT >= TR - 1 ; { ждать условия }
\`\`\`

### Голый WAIT UNTIL опасен
Если условие никогда не наступит (заклинило клапан, нет концевика, не греет пар), фаза **висит вечно**, оператор видит «PHASE HEAT» и ничего не происходит. Правило: **у каждого ожидания процесса есть тайм-аут** и действие при тайм-ауте.

Шаблон тайм-аута:
\`\`\`
T := 0 ;
WHILE NOT ::REACTOR:ZSO406.CIN DO
  IF T >= TMAX THEN
    ::REACTOR:XV406.IN := FALSE ;        { безопасное состояние }
    SENDMSG "XV406 FAILED TO OPEN" ;
    EXIT ;                               { или GOTO FAILED }
  ENDIF ;
  WAIT 1 ;
  T := T + 1 ;
ENDWHILE ;
\`\`\`
Вместо счётчика можно использовать **блок TIM** (4 таймера) или время CP; в полном HLBL есть свои средства контроля времени — смотрите B0400DF.

### Что делать при тайм-ауте — решает FDS
- **закрыть** то, что открыли (клапан, насос), вернуть регулятор в Manual 0 — если продолжать опасно;
- **оставить** как есть и сообщить — если действие безопасно и нужно решение оператора (например, охлаждение продолжается, лаба 4);
- перевести фазу в **Held** (удержание) и ждать команды оператора.

### Сообщения оператору
\`SENDMSG "текст"\` — сообщение в журнал/на станцию оператора. Хорошие сообщения:
- **короткие, заглавными**, с тегом оборудования: \`"R-401 HELD - AGITATOR STOPPED"\`;
- на **старт** и **конец** каждой фазы, на каждый отказ — с причиной;
- без жаргона программиста (\`"ERR 3"\` оператору ничего не скажет).
В полном HLBL есть и сообщения, требующие **ответа оператора** (подтверждение) — см. руководство.

### EXIT
Завершает программу. Перед EXIT оборудование должно остаться в **определённом безопасном** состоянии.
`,
      classic: `
### В I/A Series V8
Сообщения последовательностей попадают в журнал (и на принтер), подтверждения оператора — через специальные сообщения/дисплеи.
`,
      modern: `
### В EcoStruxure Foxboro DCS
Сообщения видны в Control HMI; для batch часто используют пакет управления партиями с журналом партии (electronic batch record).
`,
      field: `
### Как говорят на объекте
- «Фаза **висит на WAIT UNTIL**».
- «Где **тайм-аут** на концевик?» — первый вопрос на ревью кода.
`,
      practice: [
        { label: 'Лаба 2: DISCHARGE — тайм-аут на концевик', view: 'curriculum', lab: 'h2-discharge' },
        { label: 'Лаба 4: COOL — тайм-аут на аналоговом условии', view: 'curriculum', lab: 'h4-cool' },
      ],
      quiz: [
        one('h2l2q1', 'Что делают остальные блоки CP, пока программа стоит на WAIT?', ['Тоже ждут', 'Работают как обычно', 'Переходят в Manual', 'Останавливаются'], 1, 'WAIT приостанавливает только эту программу.', S),
        one('h2l2q2', 'Главный риск этого кода?', ['Ошибка синтаксиса', 'Нет тайм-аута: если концевик не придёт, фаза висит вечно', 'Клапан не закроется сразу', 'Нет'], 1, 'Каждое ожидание процесса — с тайм-аутом.', S, '::REACTOR:XV406.IN := TRUE ;\nWAIT UNTIL ::REACTOR:ZSO406.CIN ;'),
        tf('h2l2q3', 'При тайм-ауте фаза всегда должна закрыть все клапаны.', false, 'Решает FDS: иногда безопаснее оставить действие и сообщить.', S),
        one('h2l2q4', 'Какое сообщение лучше для оператора?', ['"ERR 3"', '"R-401 HELD - AGITATOR STOPPED"', '"oops"', '"WHILE FAILED AT LINE 40"'], 1, 'Тег оборудования и причина.', S),
        many('h2l2q5', 'Чем можно отсчитать тайм-аут?', ['Счётчик в цикле с WAIT 1', 'Блок TIM', 'Время CP', 'Цвет кнопки Process'], [0, 1, 2], 'Три способа.', S),
      ],
      interview: [
        iq(
          'h2l2i1',
          'Code review: a phase uses WAIT UNTIL on a valve limit switch. What do you check?',
          [
            ['Timeout on the wait', 'timeout'],
            ['Defined safe action on timeout per FDS', 'safe', 'fds'],
            ['Operator message with tag and reason', 'message'],
            ['BAD/quality of the input', 'bad'],
            ['Test case for the failure path', 'test'],
          ],
          'First, is there a timeout: a bare WAIT UNTIL hangs forever if the switch never comes. Second, what happens on timeout: the FDS should define the safe action (close the valve, put the phase in Held) and the code must do exactly that. Third, a clear operator message with the tag and reason. Fourth, the input quality: if the switch input is BAD, the phase must not treat it as a valid signal. And there must be a test case in the FAT script for the failure path, not only the normal one.',
        ),
      ],
    },
  ],
}
