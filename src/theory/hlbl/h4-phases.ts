import { iq, many, one, tf } from '../q'
import type { Module } from '../types'

const S = 'ISA-88 / HLBL'

export const H4: Module = {
  id: 'h4',
  n: 4,
  course: 'hlbl',
  title: { ru: 'Batch-фазы по ISA-88 на HLBL', en: 'ISA-88 batch phases in HLBL' },
  goal: {
    ru: 'Строить фазу по шаблону: permissives, действия, ожидание с тайм-аутом, завершение в безопасное состояние; поддерживать состояния и команды ISA-88 (Hold, Restart, Abort); разбирать полную партию R-401.',
    en: 'Build a phase from a template: permissives, actions, waits with timeouts, safe completion; support ISA-88 states and commands (Hold, Restart, Abort); walk through the full R-401 batch.',
  },
  lessons: [
    {
      id: 'h4l1',
      title: { ru: 'Шаблон фазы и модель состояний ISA-88', en: 'Phase template and the ISA-88 state model' },
      minutes: 25,
      base: `
### ISA-88 в двух словах
**Рецепт → процедура → unit procedure → операция → фаза.** Фаза — минимальное действие оборудования: CHARGE_A, CHARGE_B, HEAT, REACT, COOL, DISCHARGE. В DCS фаза — обычно HLBL-блок (DEP), её параметры (объём, температура, время) — из рецепта.

### Состояния и команды фазы
| Состояние | Команда, которая в него ведёт |
|---|---|
| **Idle** | — (готова) |
| **Running** | Start |
| **Holding → Held** | Hold (оператор или авария) |
| **Restarting → Running** | Restart |
| **Stopping → Stopped** | Stop (контролируемая остановка) |
| **Aborting → Aborted** | Abort (немедленный безопасный останов) |
| **Complete** | фаза закончилась сама |
Минимум, который ждут на собеседовании: **Hold, Restart, Abort** и разница: Hold — пауза с возможностью продолжить, Abort — конец без продолжения.

### Шаблон фазы (одна фаза — один блок)
\`\`\`
DEPENDENT_SEQUENCE
{ HEAT phase R-401, FDS 4.3.2, rev 2 }
CONSTANTS
  TAGIT = 10 ;   TMAX = 2400 ;
VARIABLES
  TR : R ;  T : I ;
USER_LABELS
  TR_SP   : RI0003 ;         { из рецепта }
  PHASENO : IO0001 ;         { номер шага для HMI }
STATEMENTS
  <<PERMISSIVES>>
  IF ::REACTOR:LT401.PNT < 100 THEN
    SENDMSG "HEAT: LEVEL TOO LOW" ;  EXIT ;
  ENDIF ;
  <<START>>
  PHASENO := 3 ;  TR := TR_SP ;
  SENDMSG "PHASE HEAT" ;
  <<AGITATOR>>
  ::REACTOR:M407.IN := TRUE ;
  T := 0 ;
  WHILE NOT ::REACTOR:YS407.CIN DO
    IF T >= TAGIT THEN GOTO FAILED ; ENDIF ;
    WAIT 1 ;  T := T + 1 ;
  ENDWHILE ;
  <<HEAT>>
  ::REACTOR:TIC401.SPT := TR ;
  ::REACTOR:TIC401.MA := TRUE ;
  T := 0 ;
  WHILE ::REACTOR:TT401.PNT < TR - 1 DO
    IF T >= TMAX THEN GOTO FAILED ; ENDIF ;
    WAIT 1 ;  T := T + 1 ;
  ENDWHILE ;
  SENDMSG "HEAT COMPLETE" ;
  EXIT ;
  <<FAILED>>
  ::REACTOR:TIC401.MA := FALSE ;
  ::REACTOR:TIC401.OUT := 20 ;     { рубашка на минимум (по FDS) }
  SENDMSG "HEAT FAILED - SEE ALARMS" ;
ENDSEQUENCE
\`\`\`

### Пять частей хорошей фазы
1. **Permissives** — проверить условия старта; если нет — **ничего не трогать**, сообщить, выйти.
2. **Старт** — номер фазы для HMI/журнала, сообщение.
3. **Действия** — режимы, задания, клапаны.
4. **Ожидание с тайм-аутом** и проверкой аварийных условий.
5. **Завершение** — оборудование в **определённое** состояние: что оставить работающим для следующей фазы (мешалка, температура), а что закрыть (подачи).

### Hold / Restart на практике
- При **Hold** фаза ставит оборудование в безопасное «паузное» состояние (подачи закрыты, температура удерживается или снижается) и **запоминает шаг**.
- При **Restart** продолжает с метки шага (\`GOTO HEAT\`), а не с начала: повторный налив уже налитого — брак партии.
- При **Abort** — безопасный останов без продолжения; партия обычно идёт в расследование (deviation).
`,
      classic: `
### В I/A Series V8
На I/A часто делают фазы на HLBL + собственную «модель состояний» через параметры блока (номер шага, команды Hold/Restart/Abort от оператора как BI-параметры). Либо используют пакет FoxBatch, который вызывает фазы по ISA-88.
`,
      modern: `
### В EcoStruxure Foxboro DCS
Batch management (ISA-88) поверх DCS: рецепты, процедуры, электронный журнал партии; фазы — в контроллере.
`,
      field: `
### Как говорят на объекте
- «Поставь фазу на **холд**», «**рестарт** с шага нагрева», «**абортнули** партию».
- «**Пермиссивы** не прошли».
`,
      practice: [
        { label: 'Лаба 3: HEAT с проверкой мешалки', view: 'curriculum', lab: 'h3-heat' },
        { label: 'Лаба 5: REACT — удержание (Hold) при отказе мешалки', view: 'curriculum', lab: 'h5-react' },
        { label: 'R-401: запустите полную партию и следите за RO01 (номер фазы)', view: 'control', scenario: 'batch' },
      ],
      quiz: [
        one('h4l1q1', 'Чем Hold отличается от Abort?', ['Ничем', 'Hold — пауза с возможностью продолжить; Abort — безопасный останов без продолжения', 'Abort можно продолжить', 'Hold только для IND'], 1, 'Основная разница на собеседовании.', S),
        one('h4l1q2', 'Permissives не выполнены. Что должна сделать фаза?', ['Начать и надеяться', 'Ничего не трогать, сообщить оператору и выйти', 'Перевести всё в Manual 100 %', 'Перезагрузить CP'], 1, 'Ничего не открывать при невыполненных условиях.', S),
        tf('h4l1q3', 'При Restart фаза налива должна начинать с самого начала (ещё раз налить весь объём).', false, 'Продолжать с шага; повторный налив — брак.', S),
        many('h4l1q4', 'Из каких частей состоит хорошая фаза?', ['Permissives', 'Старт: номер фазы и сообщение', 'Действия', 'Ожидание с тайм-аутом', 'Завершение в определённое состояние'], [0, 1, 2, 3, 4], 'Все пять.', S),
        one('h4l1q5', 'Зачем фаза пишет свой номер в выходной параметр (PHASENO, RO01)?', ['Для красоты', 'Для HMI, журнала партии и restart', 'Так требует компилятор', 'Чтобы ускорить CP'], 1, 'Видно, где партия; по номеру — restart.', S),
        one('h4l1q6', 'Что из ISA-88 — минимальное действие оборудования?', ['Рецепт', 'Процедура', 'Операция', 'Фаза'], 3, 'Фаза.', S),
      ],
      interview: [
        iq(
          'h4l1i1',
          'Walk me through how you would write a CHARGE phase in HLBL.',
          [
            ['Permissives first (vessel empty, valves, no interlock)', 'permissive'],
            ['Recipe volume, reset totaliser', 'totali', 'recipe'],
            ['Flow controller to Auto with SP', 'auto'],
            ['Wait with timeout and abnormal checks', 'timeout'],
            ['Safe end: controller Manual output 0, message', 'manual', 'output 0'],
          ],
          'First the permissives: the vessel level is low enough, outlet closed, no interlock active; if not, the phase sends a message and exits without touching anything. Then it takes the volume from the recipe, writes the phase number for the HMI, resets the totaliser, puts the flow controller in Auto with its SP. It waits until the totaliser reaches the volume, but with a timeout and checks such as flow too low. At the end the flow controller goes to Manual with output 0 so the valve is closed, and the phase reports complete. Every path, including the timeout, is covered in the test script.',
        ),
      ],
    },
    {
      id: 'h4l2',
      title: { ru: 'Разбор партии R-401 от начала до конца', en: 'The R-401 batch end to end' },
      minutes: 20,
      base: `
### Оборудование R-401 (тренажёр)
- **LT401** объём, **TT401** температура реактора, **TT402** рубашки, **PT403** давление;
- подачи: **FIC404 → FV404** (A), **FIC405 → FV405** (B), сумматоры **FQ404/FQ405** (сброс BI01, литры в RO01);
- температура: каскад **TIC401** (реактор, ведущий) → **TIC402** (рубашка, ведомый, Remote) → **TV402** split range (0–50 % вода, 50–100 % пар);
- **M407** мешалка (команда), **YS407** «работает»; **XV406** клапан выгрузки, **ZSO406** концевик «открыт»;
- блокировка **ILK401** (CALC: TT401 > 100 или PT403 > 4) → **SW402** — полное охлаждение, независимо от фаз;
- рецепт **R401_SEQ:RECIPE**: RI01 объём A, RI02 объём B, RI03 температура, RI04 время выдержки; RO01 — номер фазы.

### Последовательность партии
| Фаза | RO01 | Что делает | На что смотреть при тесте |
|---|---|---|---|
| Permissives | — | реактор пуст (LT401 ≤ 20) | непустой реактор — партия не стартует |
| **CHARGE_A** | 1 | сброс FQ404, FIC404 Auto 60 л/мин до RI01, затем Manual 0 | объём, клапан закрыт в конце |
| **CHARGE_B** | 2 | мешалка + подтверждение, FIC405 до RI02 | мешалка до подачи B |
| **HEAT** | 3 | TIC401 SPT = RI03, Auto, ждать TT401 ≥ RI03 − 1 | нет перегрева, каскад |
| **REACT** | 4 | выдержка RI04 с, проверка мешалки каждые 5 с | реакция экзотермическая! |
| **COOL** | 5 | TIC401 SPT низкий, ждать | тайм-аут при тёплой воде |
| **DISCHARGE** | 6 | XV406, концевик с тайм-аутом, до LT401 ≤ 5 | клапан заклинило |
| Complete | 7 | выгрузка закончена, оборудование в исходное | всё закрыто, TIC401 Manual |
| Hold | 9 | при отказе мешалки: SPT 30, сообщение | нагрев без мешалки опасен |

### Что улучшить в учебной программе (хорошее упражнение)
Откройте код PHASES в R-401 и найдите места, где нужен тайм-аут или проверка .BAD. Например, \`WAITUNTIL REACTOR:YS407.CIN\` в CHARGE_B ждёт мешалку без тайм-аута — именно это исправляется в лабе 6.

### Одна большая программа или блок на фазу?
- **Блок на фазу** (DEP) + супервизор (IND) или batch manager — стандарт для ISA-88: фазы переиспользуются в разных рецептах, тестируются по отдельности.
- **Одна программа** проще для маленькой установки, но её труднее тестировать и менять под change control (любая правка — повторное тестирование всей партии).
`,
      classic: `
### В I/A Series V8
Тот же разбор делается в FDS/DDS: таблица фаз, шагов, permissives, аварийных реакций — и по ней пишется test script FAT.
`,
      modern: `
### В EcoStruxure Foxboro DCS
Фазы в контроллере, процедуры и рецепты — в batch management; та же структура.
`,
      field: `
### Как говорят на объекте
- «Партия **на третьей фазе**» — RO01 = 3, HEAT.
- «**Сплит-рейндж** на рубашке» — один выход на воду и пар.
`,
      practice: [
        { label: 'R-401: полная партия, наблюдайте RO01, STMNO и тренд TT401/TT402', view: 'control', scenario: 'batch' },
        { label: 'Лаба 6: исправьте CHARGE_B', view: 'curriculum', lab: 'h6-debug' },
      ],
      quiz: [
        one('h4l2q1', 'Какой регулятор в каскаде R-401 ведомый (Remote SP)?', ['TIC401', 'TIC402', 'FIC404', 'FIC405'], 1, 'TIC402 (рубашка) получает SP от TIC401.OUT.', S),
        one('h4l2q2', 'Почему мешалка запускается до подачи B и до нагрева?', ['Так красивее', 'Без перемешивания реакция и теплообмен неравномерны, возможен локальный перегрев', 'Иначе не работает сумматор', 'Требование FoxView'], 1, 'Экзотермическая реакция.', S),
        tf('h4l2q3', 'Блокировка ILK401 по HH температуры работает, даже если последовательность остановлена.', true, 'Она в CALC + SWCH, вне HLBL.', S),
        one('h4l2q4', 'TV402 на 30 %. Что подаётся в рубашку?', ['Пар', 'Вода', 'Ничего', 'И то и другое'], 1, '0–50 % — вода, 50–100 % — пар.', S),
        one('h4l2q5', 'Почему для ISA-88 предпочитают «блок на фазу»?', ['Меньше блоков', 'Фазы переиспользуются в рецептах и тестируются отдельно', 'Быстрее компиляция', 'Так требует FoxDraw'], 1, 'Переиспользование и тестируемость.', S),
      ],
    },
  ],
}
