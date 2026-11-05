import { Delay, Plant, lag, type DistDef, type Instrument, type PlantVar } from './plant'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const AI = (tag: string, fbm: string, pnt: number, lo: number, hi: number, eu: string, en: string, ru: string): Instrument => ({ tag, fbm, pnt, kind: 'ai', lo, hi, eu, desc: { en, ru } })
const AO = (tag: string, fbm: string, pnt: number, en: string, ru: string): Instrument => ({ tag, fbm, pnt, kind: 'ao', lo: 0, hi: 100, eu: '%', desc: { en, ru } })
const DI = (tag: string, fbm: string, pnt: number, en: string, ru: string): Instrument => ({ tag, fbm, pnt, kind: 'di', desc: { en, ru } })
const DO = (tag: string, fbm: string, pnt: number, en: string, ru: string): Instrument => ({ tag, fbm, pnt, kind: 'do', desc: { en, ru } })
const D = (key: string, en: string, ru: string, unit: string, min: number, max: number, step: number, def: number): DistDef => ({ key, label: { en, ru }, unit, min, max, step, def })
const V = (en: string, ru: string, value: number | string, unit?: string): PlantVar => ({ label: { en, ru }, value, unit })

// ===================================================================== TANK
/** T-101: open tank with a level controller on the inlet valve and a draw-off pump (integrating process). */
export class TankPlant extends Plant {
  id = 'tank'
  instruments = [
    AI('LT101', 'TK1AI1', 1, 0, 5, 'M', 'Tank T-101 level', 'Уровень в баке T-101'),
    AI('FT101', 'TK1AI1', 2, 0, 30, 'M3/H', 'Inlet flow', 'Расход на входе'),
    AI('FT102', 'TK1AI1', 3, 0, 30, 'M3/H', 'Outlet flow', 'Расход на выходе'),
    AO('LV101', 'TK1AO1', 1, 'Inlet control valve', 'Регулирующий клапан на входе'),
  ]
  distDefs = [D('OUTFLOW', 'Draw-off pump flow', 'Расход откачки', 'm³/h', 0, 25, 0.5, 10), D('AREA', 'Tank cross-section', 'Сечение бака', 'm²', 0.2, 3, 0.1, 0.6)]
  h = 2.5
  qin = 10
  update(dt: number) {
    const v = this.ao('LV101')
    this.qin = lag(this.qin, (25 * v) / 100, 3, dt)
    const qout = this.h > 0.02 ? this.dist.OUTFLOW : 0
    this.h = clamp(this.h + ((this.qin - qout) / 3600 / this.dist.AREA) * dt, 0, 5.2)
    this.ai('LT101', this.h)
    this.ai('FT101', this.qin)
    this.ai('FT102', qout)
  }
  vars() {
    return [V('Level', 'Уровень', this.h, 'm'), V('Inflow', 'Приток', this.qin, 'm³/h'), V('Outflow', 'Отток', this.h > 0.02 ? this.dist.OUTFLOW : 0, 'm³/h'), V('Overflow', 'Перелив', this.h >= 5.2 ? 'YES' : 'no')]
  }
}

// ===================================================================== FLOW / PRESSURE
/** P-201 centrifugal pump and FV-201 control valve: fast, noisy flow loop with pump curve. */
export class FlowPlant extends Plant {
  id = 'flow'
  instruments = [
    AI('FT201', 'FL2AI1', 1, 0, 50, 'M3/H', 'Line flow', 'Расход в линии'),
    AI('PT202', 'FL2AI1', 2, 0, 10, 'BAR', 'Pump discharge pressure', 'Давление нагнетания насоса'),
    AO('FV201', 'FL2AO1', 1, 'Flow control valve', 'Регулирующий клапан расхода'),
    DO('P201', 'FL2DO1', 1, 'Pump P-201 start command', 'Команда пуска насоса P-201'),
    DI('YS201', 'FL2DI1', 1, 'Pump P-201 running', 'Насос P-201 в работе'),
  ]
  distDefs = [D('RESIST', 'Downstream line resistance', 'Сопротивление линии после клапана', '×', 0.5, 2, 0.05, 1), D('SUCTION', 'Suction pressure', 'Давление на всасывании', 'bar', 0, 3, 0.1, 1)]
  q = 0
  speed = 0
  update(dt: number) {
    const run = this.dout('P201')
    this.speed = lag(this.speed, run ? 1 : 0, 2, dt)
    const x = this.ao('FV201') / 100
    const head = 8 * this.speed * this.speed // bar at zero flow
    // valve + line: q = Cv(x) * sqrt(dp); pump: dp = head - k q²
    const cv = 45 * (Math.pow(30, x) - 1) / 29 // equal percentage
    const k = 8 / (55 * 55)
    const r = this.dist.RESIST
    const qss = head > 0 ? Math.sqrt(head / (k + r / Math.max(1e-6, cv * cv))) : 0
    this.q = lag(this.q, qss, 1.2, dt)
    const p = this.dist.SUCTION + Math.max(0, head - k * this.q * this.q)
    this.ai('FT201', this.q)
    this.ai('PT202', p)
    this.di('YS201', this.speed > 0.9)
  }
  vars() {
    return [V('Flow', 'Расход', this.q, 'm³/h'), V('Pump speed', 'Скорость насоса', this.speed * 100, '%'), V('Discharge pressure', 'Давление нагнетания', this.value('PT202'), 'bar')]
  }
}

// ===================================================================== HEAT EXCHANGER
/** E-301: steam-heated shell-and-tube exchanger; product outlet temperature with lag and dead time. */
export class HexPlant extends Plant {
  id = 'hex'
  instruments = [
    AI('TT301', 'HX3AI1', 1, 0, 150, 'DEGC', 'Product outlet temperature', 'Температура продукта на выходе'),
    AI('TT302', 'HX3AI1', 2, 0, 100, 'DEGC', 'Product inlet temperature', 'Температура продукта на входе'),
    AI('FT303', 'HX3AI1', 3, 0, 30, 'M3/H', 'Product flow', 'Расход продукта'),
    AI('FT304', 'HX3AI1', 4, 0, 1500, 'KG/H', 'Steam flow', 'Расход пара'),
    AO('TV301', 'HX3AO1', 1, 'Steam control valve', 'Регулирующий клапан пара'),
  ]
  distDefs = [D('FLOW', 'Product flow', 'Расход продукта', 'm³/h', 2, 25, 0.5, 10), D('TIN', 'Product inlet temperature', 'Температура на входе', '°C', 5, 60, 1, 20), D('FOUL', 'Fouling (heat transfer loss)', 'Загрязнение (потеря теплопередачи)', '%', 0, 60, 5, 0)]
  tShell = 20
  tOut = 20
  steam = 0
  private delay = new Delay(6)
  private tSensor = 20
  update(dt: number) {
    const v = this.ao('TV301')
    this.steam = lag(this.steam, (1400 * v) / 100, 2, dt) // kg/h
    const qSteam = (this.steam / 3600) * 2100 // kW
    const mcp = (this.dist.FLOW / 3600) * 1000 * 4.18 // kW/K
    const ua = 25 * (1 - this.dist.FOUL / 100)
    const qx = ua * (this.tShell - this.tOut)
    this.tShell = clamp(this.tShell + ((qSteam - qx - 0.2 * (this.tShell - 20)) / 40) * dt, 0, 160)
    this.tOut += ((qx - mcp * (this.tOut - this.dist.TIN)) / 120) * dt
    const delayed = this.delay.push(this.time, this.tOut)
    this.tSensor = lag(this.tSensor, delayed, 4, dt)
    this.ai('TT301', this.tSensor)
    this.ai('TT302', this.dist.TIN)
    this.ai('FT303', this.dist.FLOW)
    this.ai('FT304', this.steam)
  }
  vars() {
    return [V('Outlet temperature (true)', 'Температура на выходе (истинная)', this.tOut, '°C'), V('Shell temperature', 'Температура в межтрубном', this.tShell, '°C'), V('Steam flow', 'Расход пара', this.steam, 'kg/h'), V('Dead time + sensor lag', 'Запаздывание + инерция датчика', '6 s + 4 s')]
  }
}

// ===================================================================== BATCH REACTOR
/**
 * R-401 jacketed batch reactor (API intermediate): A + B → P, second order, exothermic.
 * Jacket: split range on TV402 — 0-50 % cooling water, 50-100 % steam.
 */
export class BatchReactorPlant extends Plant {
  id = 'batch'
  instruments = [
    AI('LT401', 'R4AI01', 1, 0, 1000, 'L', 'Reactor volume', 'Объём в реакторе'),
    AI('TT401', 'R4AI01', 2, 0, 150, 'DEGC', 'Reactor temperature', 'Температура в реакторе'),
    AI('TT402', 'R4AI01', 3, 0, 150, 'DEGC', 'Jacket temperature', 'Температура рубашки'),
    AI('PT403', 'R4AI01', 4, 0, 6, 'BAR', 'Reactor pressure', 'Давление в реакторе'),
    AI('FT404', 'R4AI01', 5, 0, 100, 'L/MIN', 'Feed A flow', 'Расход компонента A'),
    AI('FT405', 'R4AI01', 6, 0, 100, 'L/MIN', 'Feed B flow', 'Расход компонента B'),
    AO('FV404', 'R4AO01', 1, 'Feed A valve', 'Клапан подачи A'),
    AO('FV405', 'R4AO01', 2, 'Feed B valve', 'Клапан подачи B'),
    AO('TV402', 'R4AO01', 3, 'Jacket split-range valve (0-50 % water, 50-100 % steam)', 'Клапан рубашки split range (0-50 % вода, 50-100 % пар)'),
    DO('M407', 'R4DO01', 1, 'Agitator start command', 'Команда пуска мешалки'),
    DO('XV406', 'R4DO01', 2, 'Discharge valve open command', 'Команда открытия клапана выгрузки'),
    DI('YS407', 'R4DI01', 1, 'Agitator running', 'Мешалка в работе'),
    DI('ZSO406', 'R4DI01', 2, 'Discharge valve open limit', 'Концевик «клапан выгрузки открыт»'),
  ]
  distDefs = [D('TCW', 'Cooling water temperature', 'Температура охлаждающей воды', '°C', 5, 40, 1, 15), D('K', 'Reaction rate factor', 'Множитель скорости реакции', '×', 0.2, 4, 0.1, 1), D('CA', 'Feed A concentration', 'Концентрация A в подаче', 'mol/L', 0.5, 4, 0.1, 2)]
  vol = 0
  nA = 0
  nB = 0
  nP = 0
  tr = 20
  tj = 20
  qa = 0
  qb = 0
  qOut = 0
  agit = 0
  valvePos = 0
  agitatorFault = false
  rate = 0
  update(dt: number) {
    // feeds (L/min)
    this.qa = lag(this.qa, (90 * this.ao('FV404')) / 100, 1.5, dt)
    this.qb = lag(this.qb, (90 * this.ao('FV405')) / 100, 1.5, dt)
    const run = this.dout('M407') && !this.agitatorFault
    this.agit = lag(this.agit, run ? 1 : 0, 1.5, dt)
    this.valvePos = lag(this.valvePos, this.dout('XV406') ? 1 : 0, 2, dt)
    const out = this.vol > 0.5 ? 150 * this.valvePos : 0
    this.qOut = out
    const dVa = (this.qa / 60) * dt
    const dVb = (this.qb / 60) * dt
    const dVo = Math.min(this.vol, (out / 60) * dt)
    // composition: A and B feeds at CA, 2 mol/L
    const frac = this.vol > 0 ? dVo / this.vol : 0
    this.nA += dVa * this.dist.CA - this.nA * frac
    this.nB += dVb * 2 - this.nB * frac
    this.nP -= this.nP * frac
    const vNew = Math.max(0, this.vol + dVa + dVb - dVo)
    // energy: feeds enter at 20 °C
    const cr = Math.max(50, vNew * 4 + 300) // kJ/K
    const tFeedMix = this.vol + dVa + dVb > 0 ? (this.tr * this.vol + 20 * (dVa + dVb)) / (this.vol + dVa + dVb) : this.tr
    this.vol = vNew
    if (this.vol > 1) this.tr = tFeedMix
    // kinetics: r = k(T)·cA·cB·V, poor mixing without agitation
    const T = this.tr + 273.15
    const k = 0.008 * this.dist.K * Math.exp(-8000 * (1 / T - 1 / 353.15))
    const mix = 0.25 + 0.75 * this.agit
    const r = this.vol > 1 ? Math.min(k * mix * (this.nA / this.vol) * (this.nB / this.vol) * this.vol, Math.min(this.nA, this.nB) / dt) : 0
    this.rate = r
    this.nA -= r * dt
    this.nB -= r * dt
    this.nP += r * dt
    // heat transfer area grows with level
    const ua = (0.6 + 3.4 * Math.min(1, this.vol / 800)) * (0.4 + 0.6 * this.agit)
    const qRx = r * 80 // kJ/s
    const qJ = this.vol > 1 ? ua * (this.tj - this.tr) : 0
    this.tr += ((qRx + qJ - 0.05 * (this.tr - 20)) / cr) * dt
    // jacket split range
    const v = this.ao('TV402')
    const qSteam = v > 50 ? ((v - 50) / 50) * 260 * clamp((160 - this.tj) / 30, 0, 1) : 0
    const qCw = v < 50 ? ((50 - v) / 50) * 18 * (this.dist.TCW - this.tj) : 0
    this.tj += ((qSteam + qCw - qJ - 0.05 * (this.tj - 20)) / 150) * dt
    const p = 1 + 0.0002 * Math.exp(this.tr / 14)
    this.ai('LT401', this.vol)
    this.ai('TT401', this.tr)
    this.ai('TT402', this.tj)
    this.ai('PT403', p)
    this.ai('FT404', this.qa)
    this.ai('FT405', this.qb)
    this.di('YS407', this.agit > 0.9)
    this.di('ZSO406', this.valvePos > 0.95)
  }
  conversion() {
    const fed = this.nP + Math.min(this.nA, this.nB)
    return fed > 0 ? (this.nP / fed) * 100 : 0
  }
  vars() {
    return [
      V('Volume', 'Объём', this.vol, 'L'),
      V('Reactor temperature', 'Температура реактора', this.tr, '°C'),
      V('Jacket temperature', 'Температура рубашки', this.tj, '°C'),
      V('A', 'A', this.nA, 'mol'),
      V('B', 'B', this.nB, 'mol'),
      V('Product P', 'Продукт P', this.nP, 'mol'),
      V('Conversion', 'Конверсия', this.conversion(), '%'),
      V('Heat of reaction', 'Тепло реакции', this.rate * 80, 'kW'),
      V('Agitator', 'Мешалка', this.agitatorFault ? 'FAULT' : this.agit > 0.9 ? 'RUN' : 'STOP'),
    ]
  }
  actions() {
    return [
      { key: 'agit', label: { en: 'Agitator trip / reset', ru: 'Отказ мешалки / сброс' } },
      { key: 'empty', label: { en: 'Empty and clean the reactor', ru: 'Опорожнить и очистить реактор' } },
    ]
  }
  act(key: string) {
    if (key === 'agit') this.agitatorFault = !this.agitatorFault
    if (key === 'empty') {
      this.vol = this.nA = this.nB = this.nP = 0
      this.tr = this.tj = 20
    }
  }
}

// ===================================================================== WFI
/** T-501 hot WFI storage tank and distribution loop (pharma): level, ≥ 65 °C loop, conductivity with divert-to-drain. */
export class WfiPlant extends Plant {
  id = 'wfi'
  instruments = [
    AI('LT501', 'WF5AI1', 1, 0, 100, '%', 'WFI tank level', 'Уровень в баке WFI'),
    AI('TT502', 'WF5AI1', 2, 0, 100, 'DEGC', 'Loop return temperature', 'Температура возврата контура'),
    AI('AT503', 'WF5AI1', 3, 0, 5, 'US/CM', 'Still outlet conductivity', 'Электропроводность после дистиллятора'),
    AI('FT504', 'WF5AI1', 4, 0, 10, 'M3/H', 'Loop return flow', 'Расход возврата контура'),
    AO('FV501', 'WF5AO1', 1, 'Still production valve', 'Клапан производительности дистиллятора'),
    AO('TV502', 'WF5AO1', 2, 'Loop heater steam valve', 'Клапан пара подогревателя контура'),
    DO('XV503', 'WF5DO1', 1, 'Divert-to-drain valve', 'Клапан сброса в дренаж'),
  ]
  distDefs = [
    D('DRAW', 'Points-of-use draw', 'Отбор потребителями', 'm³/h', 0, 4, 0.1, 1.2),
    D('COND', 'Still conductivity', 'Электропроводность дистиллята', 'µS/cm', 0.3, 3, 0.05, 0.6),
    D('LOSS', 'Loop heat loss factor', 'Теплопотери контура', '×', 0.5, 3, 0.1, 1),
  ]
  lvl = 60
  t = 80
  prod = 1.2
  cond = 0.6
  update(dt: number) {
    const divert = this.dout('XV503')
    this.prod = lag(this.prod, (3 * this.ao('FV501')) / 100, 10, dt)
    const toTank = divert ? 0 : this.prod
    // 3 m³ tank
    this.lvl = clamp(this.lvl + ((toTank - (this.lvl > 1 ? this.dist.DRAW : 0)) / 3600 / 3) * 100 * dt, 0, 100)
    const q = (this.ao('TV502') / 100) * 120 // kW
    this.t += ((q - 0.9 * this.dist.LOSS * (this.t - 20) - (toTank / 3600) * 1000 * 4.18 * (this.t - 70)) / 900) * dt
    this.cond = lag(this.cond, this.dist.COND, 8, dt)
    this.ai('LT501', this.lvl)
    this.ai('TT502', this.t)
    this.ai('AT503', this.cond, false)
    this.ai('FT504', 6)
  }
  vars() {
    return [V('Tank level', 'Уровень в баке', this.lvl, '%'), V('Loop temperature', 'Температура контура', this.t, '°C'), V('Still production', 'Производительность дистиллятора', this.prod, 'm³/h'), V('Distillate to', 'Дистиллят идёт', this.dout('XV503') ? 'DRAIN' : 'TANK')]
  }
}

// ===================================================================== CIP
/** C-601 CIP skid: tank, supply pump, heater, caustic/acid dosing, drain; run by an HLBL program. */
export class CipPlant extends Plant {
  id = 'cip'
  instruments = [
    AI('LT601', 'CI6AI1', 1, 0, 500, 'L', 'CIP tank level', 'Уровень в баке CIP'),
    AI('TT602', 'CI6AI1', 2, 0, 100, 'DEGC', 'CIP supply temperature', 'Температура подачи CIP'),
    AI('AT603', 'CI6AI1', 3, 0, 200, 'MS/CM', 'Return conductivity', 'Электропроводность возврата'),
    AI('FT604', 'CI6AI1', 4, 0, 10, 'M3/H', 'CIP supply flow', 'Расход подачи CIP'),
    AO('TV602', 'CI6AO1', 1, 'Heater steam valve', 'Клапан пара подогревателя'),
    DO('XV601', 'CI6DO1', 1, 'Water inlet valve', 'Клапан подачи воды'),
    DO('XV602', 'CI6DO1', 2, 'Caustic dosing valve', 'Клапан дозирования щёлочи'),
    DO('XV603', 'CI6DO1', 3, 'Acid dosing valve', 'Клапан дозирования кислоты'),
    DO('XV604', 'CI6DO1', 4, 'Return-to-drain valve', 'Клапан возврата в дренаж'),
    DO('P601', 'CI6DO1', 5, 'Supply pump start', 'Пуск насоса подачи'),
  ]
  distDefs = [D('SOIL', 'Soil load (dirty equipment)', 'Загрязнённость оборудования', '%', 0, 100, 5, 50)]
  vol = 0
  t = 20
  caustic = 0 // g/L
  acid = 0
  soil = 100
  flow = 0
  update(dt: number) {
    const water = this.dout('XV601') ? 8 : 0 // L/s
    const pump = this.dout('P601') && this.vol > 10
    this.flow = lag(this.flow, pump ? 6 : 0, 2, dt)
    const drain = this.dout('XV604') && pump ? 4 : 0 // L/s
    const v0 = this.vol
    this.vol = clamp(this.vol + (water - drain) * dt, 0, 520)
    if (this.vol > 0.1) {
      const dil = v0 / Math.max(this.vol, 1e-6)
      this.caustic *= Math.min(1, dil)
      this.acid *= Math.min(1, dil)
      if (water) this.t = (this.t * v0 + 15 * water * dt) / Math.max(this.vol, 1e-6)
    } else {
      this.caustic = this.acid = 0
    }
    if (this.dout('XV602') && this.vol > 10) this.caustic += (1.0 * dt * 300) / this.vol
    if (this.dout('XV603') && this.vol > 10) this.acid += (0.8 * dt * 300) / this.vol
    // neutralise
    const n = Math.min(this.caustic, this.acid)
    this.caustic -= n
    this.acid -= n
    const q = pump ? (this.ao('TV602') / 100) * 90 : 0 // kW
    if (this.vol > 5) this.t += ((q - 0.15 * (this.t - 20)) / (this.vol * 4.18 + 60)) * dt
    // cleaning: soil removed faster with hot caustic and flow
    if (pump && this.flow > 3) this.soil = Math.max(0, this.soil - (0.002 + 0.02 * Math.min(1, this.caustic / 15) * Math.max(0, (this.t - 40) / 35)) * (100 / Math.max(10, this.dist.SOIL + 10)) * dt * 10)
    const ms = 4.5 * this.caustic + 6 * this.acid + 0.05
    this.ai('LT601', this.vol)
    this.ai('TT602', this.t)
    this.ai('AT603', ms)
    this.ai('FT604', this.flow)
  }
  vars() {
    return [
      V('Tank volume', 'Объём в баке', this.vol, 'L'),
      V('Temperature', 'Температура', this.t, '°C'),
      V('Caustic', 'Щёлочь', this.caustic, 'g/L'),
      V('Acid', 'Кислота', this.acid, 'g/L'),
      V('Remaining soil', 'Остаток загрязнения', this.soil, '%'),
    ]
  }
  actions() {
    return [{ key: 'dirty', label: { en: 'Production run: equipment dirty again', ru: 'После производства: оборудование снова грязное' } }]
  }
  act(key: string) {
    if (key === 'dirty') this.soil = 100
  }
}
