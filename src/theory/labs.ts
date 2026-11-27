/**
 * HLBL labs: the trainee writes a phase, the lab runs it on the process model in several
 * test cases (normal path and abnormal paths) and checks the outcome, like a FAT test script.
 */
import { toStationDb } from '../engine/config'
import { BatchReactorPlant } from '../engine/process/models'
import { scenario } from '../engine/scenarios'
import { ControlStation } from '../engine/station'

export interface LabRun {
  st: ControlStation
  plant: BatchReactorPlant
  /** program state at the end */
  state: string
  /** seconds the program ran */
  t: number
  msgs: string[]
  error: string
  /** max of a value seen during the run (by key) */
  peak: Record<string, number>
}

export interface LabCheck {
  text: string
  test: (r: LabRun) => boolean
  /** what to show when it fails */
  why?: (r: LabRun) => string
}

export interface LabCase {
  id: string
  title: string
  /** what the test case does (shown as a test step) */
  setup: string
  prepare: (plant: BatchReactorPlant, recipe: (k: string, v: number) => void) => void
  maxTime: number
  /** called every second of the run (to inject a fault mid-phase) */
  during?: (plant: BatchReactorPlant, t: number) => void
  checks: LabCheck[]
}

export interface Lab {
  id: string
  title: string
  level: number
  brief: string
  starter: string
  solution: string
  cases: LabCase[]
}

const n = (v: unknown) => Number(v)
const blk = (r: LabRun, c: string, b: string, p: string) => r.st.block(c, b)?.p[p]
const ended = (r: LabRun) => r.state === 'DONE' || r.state === 'IDLE'

/** Run the trainee's program on the R-401 model. */
export function runLab(code: string, c: LabCase): LabRun {
  const sc = scenario('batch')
  const cfg = sc.cfg()
  const seq = cfg.compounds.find((x) => x.name === 'R401_SEQ')!
  const ph = seq.blocks.find((b) => b.name === 'PHASES')!
  ph.v.SOURCE = code
  const plant = sc.plant!() as BatchReactorPlant
  const st = new ControlStation(toStationDb(cfg), plant.field())
  st.onTick = (dt) => plant.step(dt)
  c.prepare(plant, (k, v) => st.set('R401_SEQ', 'RECIPE', k, v))
  st.run(2) // let inputs settle
  const h0 = st.alarms.history.length
  st.set('R401_SEQ', 'PHASES', 'ACTIVE', true)
  const peak: Record<string, number> = { vol: plant.vol, fv404: 0, fv405: 0, tv402: 0 }
  let t = 0
  for (; t < c.maxTime; t++) {
    c.during?.(plant, t)
    st.run(1)
    peak.vol = Math.max(peak.vol, plant.vol)
    peak.fv404 = Math.max(peak.fv404, n(st.block('REACTOR', 'FV404')?.p.OUT))
    peak.fv405 = Math.max(peak.fv405, n(st.block('REACTOR', 'FV405')?.p.OUT))
    peak.tv402 = Math.max(peak.tv402, n(st.block('REACTOR', 'TV402')?.p.OUT))
    const s = String(st.block('R401_SEQ', 'PHASES')!.p.STATE)
    if (s === 'DONE' || s === 'ERROR' || (s === 'IDLE' && t > 0)) break
  }
  const p = st.block('R401_SEQ', 'PHASES')!.p
  return {
    st,
    plant,
    state: String(p.STATE),
    t,
    msgs: st.alarms.history
      .slice(h0)
      .filter((h) => h.type === 'MSG')
      .map((h) => h.text),
    error: String(p.PERROR ?? ''),
    peak,
  }
}

const finished: LabCheck = {
  text: 'Программа завершилась сама (DONE), не зависла и без ошибок',
  test: (r) => ended(r) && !r.error,
  why: (r) => `STATE = ${r.state}${r.error ? `, ${r.error}` : ''}, прошло ${r.t} с`,
}
const saidSomething: LabCheck = { text: 'Оператор получил сообщение (SENDMSG)', test: (r) => r.msgs.length > 0, why: () => 'сообщений не было' }

export const LABS: Lab[] = [
  {
    id: 'h1-charge',
    level: 1,
    title: 'Фаза CHARGE_A с проверкой условий старта',
    brief: `
Напишите фазу налива компонента A в реактор R-401.

**Требования (как в FDS):**
1. Объём берётся из рецепта: \`R401_SEQ:RECIPE.RI01\` (литры).
2. **Условие старта**: реактор пуст — \`REACTOR:LT401.PNT\` не больше 20 л. Если нет, сообщить оператору и **ничего не открывать**.
3. Перед наливом сбросить сумматор \`REACTOR:FQ404\`: \`BI01 := TRUE\`, подождать 1 с, \`BI01 := FALSE\`. Сумматор считает литры в \`REACTOR:FQ404.RO01\`.
4. Наливать регулятором расхода \`REACTOR:FIC404\`: задание 60 л/мин, режим Auto (\`MA := TRUE\`).
5. Когда налито не меньше заданного объёма — \`FIC404\` в Manual (\`MA := FALSE\`) и \`OUT := 0\`.
6. Сообщения оператору о старте и завершении фазы.

Тренажёр прогонит программу на модели в двух тест-кейсах: нормальный налив и «реактор не пуст».
`,
    starter: `-- CHARGE_A
VA := R401_SEQ:RECIPE.RI01
-- 1. условие старта

-- 2. сброс сумматора

-- 3. налив

-- 4. завершение
`,
    solution: `VA := R401_SEQ:RECIPE.RI01
IF REACTOR:LT401.PNT > 20 THEN
  SENDMSG "R-401 NOT EMPTY - CHARGE_A NOT STARTED"
  EXIT
ENDIF
SENDMSG "PHASE CHARGE_A"
REACTOR:FQ404.BI01 := TRUE
WAIT 1
REACTOR:FQ404.BI01 := FALSE
REACTOR:FIC404.SPT := 60
REACTOR:FIC404.MA := TRUE
WAITUNTIL REACTOR:FQ404.RO01 >= VA
REACTOR:FIC404.MA := FALSE
REACTOR:FIC404.OUT := 0
SENDMSG "CHARGE_A COMPLETE"
`,
    cases: [
      {
        id: 'normal',
        title: 'Нормальный налив 300 л',
        setup: 'Реактор пуст, рецепт RI01 = 300 л.',
        prepare: (pl, rec) => {
          pl.vol = 0
          rec('RI01', 300)
        },
        maxTime: 600,
        checks: [
          finished,
          { text: 'В реакторе 290–320 л', test: (r) => r.plant.vol >= 290 && r.plant.vol <= 320, why: (r) => `объём ${r.plant.vol.toFixed(0)} л` },
          {
            text: 'В конце FIC404 в Manual, клапан FV404 закрыт',
            test: (r) => blk(r, 'REACTOR', 'FIC404', 'MA') === false && n(blk(r, 'REACTOR', 'FV404', 'OUT')) < 1,
            why: (r) => `FIC404.MA = ${blk(r, 'REACTOR', 'FIC404', 'MA')}, FV404.OUT = ${n(blk(r, 'REACTOR', 'FV404', 'OUT')).toFixed(1)} %`,
          },
          saidSomething,
        ],
      },
      {
        id: 'not-empty',
        title: 'Реактор не пуст (условие старта не выполнено)',
        setup: 'В реакторе уже 250 л, рецепт RI01 = 300 л.',
        prepare: (pl, rec) => {
          pl.vol = 250
          rec('RI01', 300)
        },
        maxTime: 120,
        checks: [
          finished,
          {
            text: 'Подача A не открывалась (объём не вырос)',
            test: (r) => r.peak.vol < 255 && r.peak.fv404 < 1,
            why: (r) => `макс. объём ${r.peak.vol.toFixed(0)} л, макс. FV404 ${r.peak.fv404.toFixed(0)} %`,
          },
          saidSomething,
        ],
      },
    ],
  },
  {
    id: 'h2-discharge',
    level: 2,
    title: 'Фаза DISCHARGE с тайм-аутом на концевик',
    brief: `
Напишите фазу выгрузки реактора.

**Требования:**
1. Открыть клапан выгрузки: \`REACTOR:XV406.IN := TRUE\`.
2. Дождаться концевика «открыт» \`REACTOR:ZSO406.CIN\` **не дольше 30 с**. Если не пришёл — закрыть клапан, сообщить «XV406 FAILED TO OPEN» и завершить фазу.
3. Дождаться, пока объём \`REACTOR:LT401.PNT\` станет не больше 5 л.
4. Закрыть клапан и сообщить о завершении.

Тест-кейсы: нормальная выгрузка и **клапан заклинило** (концевик не приходит). В учебном HLBL нет встроенного тайм-аута: сделайте его циклом WHILE со счётчиком (см. урок 8.2).
`,
    starter: `-- DISCHARGE
SENDMSG "PHASE DISCHARGE"
REACTOR:XV406.IN := TRUE
-- ждать ZSO406 не дольше 30 с

-- ждать опорожнения

REACTOR:XV406.IN := FALSE
`,
    solution: `SENDMSG "PHASE DISCHARGE"
REACTOR:XV406.IN := TRUE
T := 0
WHILE NOT REACTOR:ZSO406.CIN DO
  IF T >= 30 THEN
    REACTOR:XV406.IN := FALSE
    SENDMSG "XV406 FAILED TO OPEN"
    EXIT
  ENDIF
  WAIT 1
  T := T + 1
ENDWHILE
WAITUNTIL REACTOR:LT401.PNT <= 5
REACTOR:XV406.IN := FALSE
SENDMSG "DISCHARGE COMPLETE"
`,
    cases: [
      {
        id: 'normal',
        title: 'Нормальная выгрузка',
        setup: 'В реакторе 400 л, клапан исправен.',
        prepare: (pl) => {
          pl.vol = 400
        },
        maxTime: 600,
        checks: [
          finished,
          { text: 'Реактор опорожнён (≤ 5 л)', test: (r) => r.plant.vol <= 5, why: (r) => `объём ${r.plant.vol.toFixed(0)} л` },
          { text: 'Клапан XV406 в конце закрыт', test: (r) => blk(r, 'REACTOR', 'XV406', 'IN') === false, why: () => 'XV406.IN = TRUE' },
        ],
      },
      {
        id: 'stuck',
        title: 'Клапан выгрузки заклинило',
        setup: 'В реакторе 400 л, XV406 не открывается (концевик ZSO406 не приходит).',
        prepare: (pl) => {
          pl.vol = 400
          pl.dischargeStuck = true
        },
        maxTime: 120,
        checks: [
          { text: 'Фаза завершилась сама не позже чем через ~35 с (не зависла)', test: (r) => ended(r) && r.t <= 40, why: (r) => `STATE = ${r.state}, прошло ${r.t} с` },
          { text: 'Команда на клапан снята (XV406.IN = FALSE)', test: (r) => blk(r, 'REACTOR', 'XV406', 'IN') === false, why: () => 'XV406.IN осталась TRUE' },
          { text: 'Оператору сообщено об отказе клапана', test: (r) => r.msgs.some((m) => /XV406|FAIL|ОТКАЗ/i.test(m)), why: (r) => `сообщения: ${r.msgs.join(' | ') || 'нет'}` },
        ],
      },
    ],
  },
  {
    id: 'h3-heat',
    level: 3,
    title: 'Фаза HEAT с проверкой мешалки',
    brief: `
Напишите фазу нагрева реактора до температуры из рецепта.

**Требования:**
1. Температура из рецепта: \`R401_SEQ:RECIPE.RI03\` (°C).
2. Пустить мешалку \`REACTOR:M407.IN := TRUE\` и дождаться сигнала «в работе» \`REACTOR:YS407.CIN\` **не дольше 10 с**.
3. Если мешалка не запустилась: **не нагревать** (TIC401 оставить в Manual), снять команду мешалки, сообщить оператору и завершить фазу. Нагрев без перемешивания опасен для экзотермической реакции.
4. Если запустилась: \`REACTOR:TIC401.SPT\` := температура рецепта, \`TIC401.MA := TRUE\`, ждать \`REACTOR:TT401.PNT\` ≥ температура − 1.
5. Сообщить о завершении нагрева.

Тест-кейсы: нормальный нагрев до 60 °C и отказ мешалки.
`,
    starter: `-- HEAT
TR := R401_SEQ:RECIPE.RI03
`,
    solution: `TR := R401_SEQ:RECIPE.RI03
SENDMSG "PHASE HEAT"
REACTOR:M407.IN := TRUE
T := 0
WHILE NOT REACTOR:YS407.CIN DO
  IF T >= 10 THEN
    REACTOR:M407.IN := FALSE
    SENDMSG "AGITATOR FAILED - HEAT NOT STARTED"
    EXIT
  ENDIF
  WAIT 1
  T := T + 1
ENDWHILE
REACTOR:TIC401.SPT := TR
REACTOR:TIC401.MA := TRUE
WAITUNTIL REACTOR:TT401.PNT >= TR - 1
SENDMSG "HEAT COMPLETE"
`,
    cases: [
      {
        id: 'normal',
        title: 'Нормальный нагрев до 60 °C',
        setup: 'В реакторе 400 л при 20 °C, мешалка исправна, рецепт RI03 = 60 °C.',
        prepare: (pl, rec) => {
          pl.vol = 400
          rec('RI03', 60)
        },
        maxTime: 2400,
        checks: [
          finished,
          { text: 'Температура в реакторе TT401 ≥ 58,5 °C', test: (r) => n(blk(r, 'REACTOR', 'TT401', 'PNT')) >= 58.5, why: (r) => `TT401 = ${n(blk(r, 'REACTOR', 'TT401', 'PNT')).toFixed(1)} °C` },
          {
            text: 'TIC401 в Auto с заданием 60',
            test: (r) => blk(r, 'REACTOR', 'TIC401', 'MA') === true && Math.abs(n(blk(r, 'REACTOR', 'TIC401', 'SPT')) - 60) < 0.5,
            why: (r) => `MA = ${blk(r, 'REACTOR', 'TIC401', 'MA')}, SPT = ${blk(r, 'REACTOR', 'TIC401', 'SPT')}`,
          },
        ],
      },
      {
        id: 'agitator',
        title: 'Мешалка не запускается',
        setup: 'В реакторе 400 л, мешалка в отказе (YS407 не приходит), рецепт RI03 = 60 °C.',
        prepare: (pl, rec) => {
          pl.vol = 400
          pl.agitatorFault = true
          rec('RI03', 60)
        },
        maxTime: 120,
        checks: [
          { text: 'Фаза завершилась сама не позже чем через ~15 с', test: (r) => ended(r) && r.t <= 20, why: (r) => `STATE = ${r.state}, прошло ${r.t} с` },
          {
            text: 'Нагрев не включался (TIC401 в Manual, температура не выросла)',
            test: (r) => blk(r, 'REACTOR', 'TIC401', 'MA') === false && r.plant.tr < 25,
            why: (r) => `TIC401.MA = ${blk(r, 'REACTOR', 'TIC401', 'MA')}, TT401 = ${r.plant.tr.toFixed(1)} °C`,
          },
          { text: 'Команда мешалки снята', test: (r) => blk(r, 'REACTOR', 'M407', 'IN') === false, why: () => 'M407.IN осталась TRUE' },
          saidSomething,
        ],
      },
    ],
  },
  {
    id: 'h4-cool',
    level: 2,
    title: 'Фаза COOL: тайм-аут на аналоговом условии',
    brief: `
Напишите фазу охлаждения реактора после реакции. Пишите **в полном формате программы HLBL** (как в настоящем блоке): \`DEPENDENT_SEQUENCE\`, секции \`VARIABLES\`, \`USER_LABELS\`, \`STATEMENTS\`, \`ENDSEQUENCE\` (см. курс HLBL, модуль H1).

**Требования:**
1. Температура конца охлаждения — из рецепта: \`R401_SEQ:RECIPE.RI03\` (°C).
2. Пустить мешалку \`REACTOR:M407.IN := TRUE\` (без перемешивания теплообмен с рубашкой плохой). Затем \`REACTOR:TIC401.SPT\` := эта температура, \`TIC401.MA := TRUE\` (каскад сам откроет воду в рубашку).
3. Ждать \`REACTOR:TT401.PNT\` ≤ температура + 1, **но не дольше 900 с**.
4. Если не успели — сообщить оператору «COOL TIMEOUT» и завершить фазу. TIC401 оставить в Auto: охлаждение продолжается, решение принимает оператор.
5. Если успели — сообщение «COOL COMPLETE».

Тест-кейсы: нормальное охлаждение 60 → 40 °C и **тёплая оборотная вода** (40 °C: до 41 °C за 900 с не остудить).
`,
    starter: `DEPENDENT_SEQUENCE
{ COOL phase, R-401 }
VARIABLES
  TC : R ;
  T  : I ;
USER_LABELS
  TEMP  : REACTOR:TT401.PNT ;
  TCSPT : REACTOR:TIC401.SPT ;
STATEMENTS
  TC := R401_SEQ:RECIPE.RI03 ;
  { ваш код }
ENDSEQUENCE
`,
    solution: `DEPENDENT_SEQUENCE
{ COOL phase, R-401 }
CONSTANTS
  TMAX = 900 ;
VARIABLES
  TC : R ;
  T  : I ;
USER_LABELS
  TEMP  : REACTOR:TT401.PNT ;
  TCSPT : REACTOR:TIC401.SPT ;
  TCMA  : REACTOR:TIC401.MA ;
STATEMENTS
  TC := R401_SEQ:RECIPE.RI03 ;
  SENDMSG "PHASE COOL" ;
  REACTOR:M407.IN := TRUE ;
  TCSPT := TC ;
  TCMA := TRUE ;
  T := 0 ;
  WHILE TEMP > TC + 1 DO
    IF T >= TMAX THEN
      SENDMSG "COOL TIMEOUT" ;
      EXIT ;
    ENDIF ;
    WAIT 1 ;
    T := T + 1 ;
  ENDWHILE ;
  SENDMSG "COOL COMPLETE" ;
ENDSEQUENCE
`,
    cases: [
      {
        id: 'normal',
        title: 'Нормальное охлаждение 60 → 40 °C',
        setup: 'В реакторе 400 л при 60 °C, оборотная вода 15 °C, рецепт RI03 = 40 °C.',
        prepare: (pl, rec) => {
          pl.vol = 400
          pl.tr = 60
          pl.tj = 60
          rec('RI03', 40)
        },
        maxTime: 1000,
        checks: [
          finished,
          { text: 'TT401 ≈ 41 °C или ниже', test: (r) => n(blk(r, 'REACTOR', 'TT401', 'PNT')) <= 41.8, why: (r) => `TT401 = ${n(blk(r, 'REACTOR', 'TT401', 'PNT')).toFixed(1)} °C` },
          { text: 'Сообщение о завершении, без «TIMEOUT»', test: (r) => r.msgs.length > 0 && !r.msgs.some((m) => /TIMEOUT/i.test(m)), why: (r) => `сообщения: ${r.msgs.join(' | ') || 'нет'}` },
        ],
      },
      {
        id: 'warm-cw',
        title: 'Тёплая оборотная вода (40 °C)',
        setup: 'В реакторе 400 л при 60 °C, оборотная вода 40 °C, рецепт RI03 = 40 °C. За 900 с цель недостижима.',
        prepare: (pl, rec) => {
          pl.vol = 400
          pl.tr = 60
          pl.tj = 60
          pl.dist.TCW = 40
          rec('RI03', 40)
        },
        maxTime: 1100,
        checks: [
          { text: 'Фаза завершилась сама через ~900 с (не зависла)', test: (r) => ended(r) && r.t >= 850 && r.t <= 960, why: (r) => `STATE = ${r.state}, прошло ${r.t} с` },
          { text: 'Оператору сообщено о тайм-ауте', test: (r) => r.msgs.some((m) => /TIMEOUT|ТАЙМ/i.test(m)), why: (r) => `сообщения: ${r.msgs.join(' | ') || 'нет'}` },
          { text: 'TIC401 остался в Auto (охлаждение продолжается)', test: (r) => blk(r, 'REACTOR', 'TIC401', 'MA') === true, why: (r) => `TIC401.MA = ${blk(r, 'REACTOR', 'TIC401', 'MA')}` },
        ],
      },
    ],
  },
  {
    id: 'h5-react',
    level: 3,
    title: 'Фаза REACT: выдержка с мониторингом (как MON → EXC)',
    brief: `
Напишите фазу выдержки при температуре реакции, которая **сама следит за аварийными условиями** во время выдержки. В настоящей системе это часто делают отдельным блоком **MON**, который запускает **EXC** (курс HLBL, модуль H3). Здесь — в одном блоке, циклом.

**Требования:**
1. Номер фазы для HMI: \`R401_SEQ:RECIPE.RO01 := 4\`.
2. Мешалка должна работать: \`REACTOR:M407.IN := TRUE\`, ждать \`REACTOR:YS407.CIN\` не дольше 10 с (иначе сообщение и выход, нагрев не включать).
3. \`REACTOR:TIC401.SPT\` := \`R401_SEQ:RECIPE.RI03\`, \`TIC401.MA := TRUE\`.
4. Выдержка \`R401_SEQ:RECIPE.RI04\` секунд. **Каждую секунду** проверять:
   - мешалка остановилась (\`NOT REACTOR:YS407.CIN\`) **или** \`TT401\` выше температуры рецепта на 10 °C и более →
   - **удержание (hold)**: \`TIC401.SPT := 30\` (охлаждать), \`RO01 := 9\`, сообщение оператору, выход.
5. Нормальное окончание: сообщение «REACT COMPLETE».

Тест-кейсы: нормальная выдержка 120 с и **отказ мешалки на 40-й секунде**.
`,
    starter: `-- REACT
R401_SEQ:RECIPE.RO01 := 4
TR := R401_SEQ:RECIPE.RI03
HOLDT := R401_SEQ:RECIPE.RI04
`,
    solution: `R401_SEQ:RECIPE.RO01 := 4
TR := R401_SEQ:RECIPE.RI03
HOLDT := R401_SEQ:RECIPE.RI04
SENDMSG "PHASE REACT"
REACTOR:M407.IN := TRUE
T := 0
WHILE NOT REACTOR:YS407.CIN DO
  IF T >= 10 THEN
    REACTOR:M407.IN := FALSE
    SENDMSG "AGITATOR FAILED - REACT NOT STARTED"
    EXIT
  ENDIF
  WAIT 1
  T := T + 1
ENDWHILE
REACTOR:TIC401.SPT := TR
REACTOR:TIC401.MA := TRUE
T := 0
WHILE T < HOLDT DO
  IF NOT REACTOR:YS407.CIN OR REACTOR:TT401.PNT >= TR + 10 THEN
    REACTOR:TIC401.SPT := 30
    R401_SEQ:RECIPE.RO01 := 9
    SENDMSG "R-401 HELD - AGITATOR STOPPED OR TEMP HIGH"
    EXIT
  ENDIF
  WAIT 1
  T := T + 1
ENDWHILE
SENDMSG "REACT COMPLETE"
`,
    cases: [
      {
        id: 'normal',
        title: 'Нормальная выдержка 120 с при 80 °C',
        setup: 'В реакторе 600 л при 80 °C, мешалка исправна, RI03 = 80 °C, RI04 = 120 с.',
        prepare: (pl, rec) => {
          pl.vol = 600
          pl.tr = 80
          pl.tj = 80
          rec('RI03', 80)
          rec('RI04', 120)
        },
        maxTime: 400,
        checks: [
          finished,
          { text: 'Выдержка длилась не меньше 120 с', test: (r) => r.t >= 120, why: (r) => `фаза закончилась через ${r.t} с` },
          { text: 'RO01 = 4 (фаза REACT), TIC401 в Auto с SPT 80', test: (r) => n(blk(r, 'R401_SEQ', 'RECIPE', 'RO01')) === 4 && blk(r, 'REACTOR', 'TIC401', 'MA') === true && Math.abs(n(blk(r, 'REACTOR', 'TIC401', 'SPT')) - 80) < 0.5, why: (r) => `RO01 = ${blk(r, 'R401_SEQ', 'RECIPE', 'RO01')}, MA = ${blk(r, 'REACTOR', 'TIC401', 'MA')}, SPT = ${blk(r, 'REACTOR', 'TIC401', 'SPT')}` },
        ],
      },
      {
        id: 'agitator-trip',
        title: 'Мешалка отказала на 40-й секунде',
        setup: 'Как в нормальном случае, но на 40-й секунде мешалка останавливается (YS407 пропадает).',
        prepare: (pl, rec) => {
          pl.vol = 600
          pl.tr = 80
          pl.tj = 80
          rec('RI03', 80)
          rec('RI04', 120)
        },
        during: (pl, t) => {
          if (t === 40) pl.agitatorFault = true
        },
        maxTime: 400,
        checks: [
          { text: 'Фаза завершилась сразу после отказа (до 60 с), а не после выдержки', test: (r) => ended(r) && r.t <= 60, why: (r) => `STATE = ${r.state}, прошло ${r.t} с` },
          { text: 'Удержание: TIC401.SPT ≤ 30, RO01 = 9', test: (r) => n(blk(r, 'REACTOR', 'TIC401', 'SPT')) <= 30 && n(blk(r, 'R401_SEQ', 'RECIPE', 'RO01')) === 9, why: (r) => `SPT = ${blk(r, 'REACTOR', 'TIC401', 'SPT')}, RO01 = ${blk(r, 'R401_SEQ', 'RECIPE', 'RO01')}` },
          saidSomething,
        ],
      },
    ],
  },
  {
    id: 'h6-debug',
    level: 3,
    title: 'Отладка: найдите 3 ошибки в CHARGE_B',
    brief: `
Коллега написал фазу CHARGE_B, и на FAT она не прошла. Код уже в редакторе. **Найдите и исправьте три ошибки** (подсказки ниже, если нужны). Это типичная задача на собеседовании: «вот код фазы, что с ним не так?».

**Что должна делать фаза (по FDS):**
1. Объём B — \`R401_SEQ:RECIPE.RI02\` (л).
2. Мешалка работает до подачи B: \`M407.IN := TRUE\`, \`YS407.CIN\` не дольше 10 с; если нет — снять команду, сообщить, **не подавать B**.
3. Сбросить сумматор \`FQ405\` (\`BI01\` TRUE → 1 с → FALSE).
4. Подача регулятором \`FIC405\`: SPT 40 л/мин, Auto, пока \`FQ405.RO01\` < объёма.
5. В конце \`FIC405\` в Manual и **выход 0** (клапан FV405 закрыт).

**Подсказки** (если застряли):
- Что будет, если мешалка не запустится?
- Сумматор считает, только когда BI01 = FALSE.
- В Manual PID держит последний выход.

Запустите тесты сначала с исходным кодом и посмотрите, какие проверки падают. Это и есть отладка по результатам теста.
`,
    starter: `-- CHARGE_B (has 3 bugs)
VB := R401_SEQ:RECIPE.RI02
SENDMSG "PHASE CHARGE_B"
REACTOR:M407.IN := TRUE
WAITUNTIL REACTOR:YS407.CIN
REACTOR:FQ405.BI01 := TRUE
WAIT 1
REACTOR:FIC405.SPT := 40
REACTOR:FIC405.MA := TRUE
WAITUNTIL REACTOR:FQ405.RO01 >= VB
REACTOR:FIC405.MA := FALSE
SENDMSG "CHARGE_B COMPLETE"
`,
    solution: `VB := R401_SEQ:RECIPE.RI02
SENDMSG "PHASE CHARGE_B"
REACTOR:M407.IN := TRUE
T := 0
WHILE NOT REACTOR:YS407.CIN DO
  IF T >= 10 THEN
    REACTOR:M407.IN := FALSE
    SENDMSG "AGITATOR FAILED - CHARGE_B NOT STARTED"
    EXIT
  ENDIF
  WAIT 1
  T := T + 1
ENDWHILE
REACTOR:FQ405.BI01 := TRUE
WAIT 1
REACTOR:FQ405.BI01 := FALSE
REACTOR:FIC405.SPT := 40
REACTOR:FIC405.MA := TRUE
WAITUNTIL REACTOR:FQ405.RO01 >= VB
REACTOR:FIC405.MA := FALSE
REACTOR:FIC405.OUT := 0
SENDMSG "CHARGE_B COMPLETE"
`,
    cases: [
      {
        id: 'normal',
        title: 'Нормальная подача 200 л',
        setup: 'В реакторе 300 л компонента A, мешалка исправна, RI02 = 200 л.',
        prepare: (pl, rec) => {
          pl.vol = 300
          rec('RI02', 200)
        },
        maxTime: 600,
        checks: [
          finished,
          { text: 'В реакторе 490–520 л', test: (r) => r.plant.vol >= 490 && r.plant.vol <= 520, why: (r) => `объём ${r.plant.vol.toFixed(0)} л` },
          {
            text: 'В конце FIC405 в Manual, клапан FV405 закрыт',
            test: (r) => blk(r, 'REACTOR', 'FIC405', 'MA') === false && n(blk(r, 'REACTOR', 'FV405', 'OUT')) < 1,
            why: (r) => `FIC405.MA = ${blk(r, 'REACTOR', 'FIC405', 'MA')}, FV405.OUT = ${n(blk(r, 'REACTOR', 'FV405', 'OUT')).toFixed(1)} %`,
          },
        ],
      },
      {
        id: 'agitator',
        title: 'Мешалка не запускается',
        setup: 'В реакторе 300 л, мешалка в отказе, RI02 = 200 л.',
        prepare: (pl, rec) => {
          pl.vol = 300
          pl.agitatorFault = true
          rec('RI02', 200)
        },
        maxTime: 120,
        checks: [
          { text: 'Фаза завершилась сама не позже чем через ~15 с', test: (r) => ended(r) && r.t <= 20, why: (r) => `STATE = ${r.state}, прошло ${r.t} с` },
          { text: 'Подача B не открывалась', test: (r) => r.peak.fv405 < 1, why: (r) => `макс. FV405 ${r.peak.fv405.toFixed(0)} %` },
          { text: 'Команда мешалки снята', test: (r) => blk(r, 'REACTOR', 'M407', 'IN') === false, why: () => 'M407.IN осталась TRUE' },
          saidSomething,
        ],
      },
    ],
  },
]

export const labById = (id?: string) => LABS.find((l) => l.id === id)

export function gradeLab(lab: Lab, code: string) {
  return lab.cases.map((c) => {
    const r = runLab(code, c)
    const results = c.checks.map((k) => ({ k, ok: k.test(r), why: k.test(r) ? '' : (k.why?.(r) ?? '') }))
    return { c, r, results, ok: results.every((x) => x.ok) }
  })
}
