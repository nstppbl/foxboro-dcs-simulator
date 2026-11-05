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
  const peak: Record<string, number> = { vol: plant.vol, fv404: 0, tv402: 0 }
  let t = 0
  for (; t < c.maxTime; t++) {
    st.run(1)
    peak.vol = Math.max(peak.vol, plant.vol)
    peak.fv404 = Math.max(peak.fv404, n(st.block('REACTOR', 'FV404')?.p.OUT))
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
]

export const labById = (id?: string) => LABS.find((l) => l.id === id)

export function gradeLab(lab: Lab, code: string) {
  return lab.cases.map((c) => {
    const r = runLab(code, c)
    const results = c.checks.map((k) => ({ k, ok: k.test(r), why: k.test(r) ? '' : (k.why?.(r) ?? '') }))
    return { c, r, results, ok: results.every((x) => x.ok) }
  })
}
