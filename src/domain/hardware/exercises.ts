/**
 * Architecture exercises: a written task (ТЗ) the trainee implements on the canvas,
 * with automatic checks for every requirement.
 */
import type { Bilingual } from './catalog'
import { familyOf, linksOf, neighbors, nodeIndex, otherEnd, typeOf, type HwNode, type Topology } from './model'
import { analyzeNetwork } from './network'
import { validateTopology } from './rules'
import { traceSignal } from './trace'

export interface CheckResult {
  ok: boolean
  /** what is still wrong (shown under the requirement) */
  detail?: Bilingual
}

export interface Requirement {
  id: string
  text: Bilingual
  hint?: Bilingual
  /** points (default 1) */
  w?: number
  test: (t: Topology) => CheckResult
}

export interface Exercise {
  id: string
  level: 1 | 2 | 3 | 4 | 5
  title: Bilingual
  /** the task statement, one paragraph per entry */
  brief: Bilingual[]
  /** I/O list or equipment table shown with the brief */
  table?: { head: string[]; rows: string[][] }
  /** starting canvas: 'empty', 'base' (a solved exercise 1) or a preset id */
  start: string
  req: Requirement[]
  src?: string
}

const B = (en: string, ru: string): Bilingual => ({ en, ru })
const ok = (): CheckResult => ({ ok: true })
const no = (en: string, ru: string): CheckResult => ({ ok: false, detail: B(en, ru) })

// ------------------------------------------------------------------ helpers
export const byType = (t: Topology, ...ids: string[]) => t.nodes.filter((n) => ids.includes(n.typeId))
export const byFamily = (t: Topology, f: string) => t.nodes.filter((n) => familyOf(n) === f)
const stations = (t: Topology) => t.nodes.filter((n) => ['workstation', 'server', 'controller', 'fcm'].includes(familyOf(n)))
const lb = (n: HwNode) => (n.letterbug ?? '').toUpperCase()
const names = (ns: HwNode[]) => ns.map((n) => n.letterbug || n.tag || typeOf(n).label).join(', ')

/** Switch sides a station is connected to. */
export function sidesOf(t: Topology, n: HwNode) {
  return new Set(neighbors(t, n.id, 'mesh').map((s) => s.side))
}

function dualAttached(t: Topology, list: HwNode[]): CheckResult {
  const bad = list.filter((n) => {
    const s = sidesOf(t, n)
    return !(s.has('A') && s.has('B'))
  })
  return bad.length ? no(`Not connected to both A and B switches: ${names(bad)}`, `Не подключены к коммутаторам A и B: ${names(bad)}`) : ok()
}

function noErrors(t: Topology): CheckResult {
  if (!t.nodes.length) return no('The canvas is empty', 'Схема пустая')
  const e = validateTopology(t).filter((i) => i.severity === 'error')
  return e.length ? no(`${e.length} error(s) in the Validation tab`, `Ошибок во вкладке «Проверка»: ${e.length}`) : ok()
}

function instrument(t: Topology, tag: string) {
  return t.nodes.find((n) => familyOf(n) === 'instrument' && (n.tag ?? '').toUpperCase() === tag)
}

/** The instrument exists with a fitting type, is wired and its signal reaches a workstation. */
function loopOk(t: Topology, tag: string, types: string[], cp?: (cp: HwNode) => boolean): CheckResult {
  const i = instrument(t, tag)
  if (!i) return no(`No instrument tagged ${tag}`, `Нет прибора с тегом ${tag}`)
  if (!types.includes(i.typeId)) return no(`${tag}: wrong instrument type (${typeOf(i).label})`, `${tag}: неверный тип прибора (${typeOf(i).label})`)
  const tr = traceSignal(t, i.id, new Set())
  if (tr.broken) return no(`${tag}: the signal path is broken (see Trace)`, `${tag}: путь сигнала не доходит до станции (см. «Трассировку»)`)
  if (cp) {
    const ids = new Set(tr.nodeIds)
    const c = t.nodes.find((n) => familyOf(n) === 'controller' && ids.has(n.id))
    if (!c || !cp(c)) return no(`${tag}: connected to the wrong controller`, `${tag}: подключён не к тому контроллеру`)
  }
  return ok()
}

function hasRange(t: Topology, tag: string, lo: number, hi: number): CheckResult {
  const i = instrument(t, tag)
  if (!i) return no(`No instrument tagged ${tag}`, `Нет прибора с тегом ${tag}`)
  return i.lo === lo && i.hi === hi ? ok() : no(`${tag}: range must be ${lo}…${hi}`, `${tag}: диапазон должен быть ${lo}…${hi}`)
}

/** Every FBM keeps at least `pct` % spare channels of each signal kind it carries. */
function spare(t: Topology, pct: number): CheckResult {
  if (!byFamily(t, 'fbm').length) return no('No FBMs yet', 'FBM ещё нет')
  const bad: string[] = []
  for (const f of byFamily(t, 'fbm')) {
    const total = (typeOf(f).channels ?? []).reduce((a, g) => a + g.count, 0)
    const ta = neighbors(t, f.id, 'tacable')[0]
    const used = ta ? linksOf(t, ta.id, 'field').length : 0
    if (total && used / total > 1 - pct / 100) bad.push(f.letterbug ?? typeOf(f).label)
  }
  return bad.length ? no(`Less than ${pct} % spare: ${bad.join(', ')}`, `Резерв меньше ${pct} %: ${bad.join(', ')}`) : ok()
}

/** Letterbug convention of the plant exercise: area (letter+digit) + 2-char sequence + 2-letter code. */
export const LB_CODE: Record<string, string[]> = {
  FCP280: ['FC'],
  FDC280: ['FD'],
  H92: ['EW', 'OW', 'AW'],
  H91: ['HS', 'BK', 'AW', 'EW'],
  H90: ['HS', 'BK', 'AW'],
  SW8: ['SW'],
  SW24: ['SW'],
  SWCH: ['SW'],
}
export const LB_RE = /^[A-Z][0-9][0-9][0-9A-Z][A-Z]{2}$/

function letterbugConvention(t: Topology): CheckResult {
  const bad = t.nodes.filter((n) => LB_CODE[n.typeId] && !(LB_RE.test(lb(n)) && LB_CODE[n.typeId].includes(lb(n).slice(4))))
  return bad.length ? no(`Letterbugs not per convention: ${names(bad)}`, `Letterbug не по правилу: ${names(bad)}`) : ok()
}

const area = (n: HwNode) => lb(n).slice(0, 2)

// ------------------------------------------------------------------ exercises
export const EXERCISES: Exercise[] = [
  {
    id: 'ex1-first',
    level: 1,
    title: B('First system: one controller, redundant network', 'Первая система: один контроллер и резервированная сеть'),
    brief: [
      B('A small unit needs a Foxboro control system. Build the control network and the stations.', 'Небольшой установке нужна система Foxboro. Соберите сеть управления и станции.'),
      B(
        'Requirements: one engineering workstation (H92), one FCP270 controller, two MESH switches — one on side A, one on side B — connected by an uplink. Every station must be connected to both switches. Give every station and switch a unique 6-character letterbug.',
        'Требования: одна инженерная станция (H92), один контроллер FCP270, два коммутатора MESH — сторона A и сторона B — соединённые uplink. Каждая станция подключается к обоим коммутаторам. У каждой станции и коммутатора — уникальный letterbug из 6 символов.',
      ),
    ],
    start: 'empty',
    src: '2-20…2-36',
    req: [
      { id: 'ws', text: B('One H92 workstation', 'Одна станция H92'), test: (t) => (byType(t, 'H92').length >= 1 ? ok() : no('No H92 on the canvas', 'Нет станции H92')) },
      {
        id: 'cp',
        text: B('One FCP270 controller', 'Один контроллер FCP270'),
        test: (t) => (byType(t, 'FCP270').length === 1 ? ok() : no('Exactly one FCP270 is required', 'Нужен ровно один FCP270')),
      },
      {
        id: 'sw',
        text: B('Two switches: side A and side B', 'Два коммутатора: сторона A и сторона B'),
        hint: B('Select a switch and set "Side" in the properties panel.', 'Выберите коммутатор и задайте «Сторона» в панели свойств.'),
        test: (t) => {
          const s = byFamily(t, 'switch')
          return s.some((x) => x.side === 'A') && s.some((x) => x.side === 'B') ? ok() : no('Need one A and one B switch', 'Нужны коммутаторы A и B')
        },
      },
      {
        id: 'up',
        text: B('The switches are linked by an uplink', 'Коммутаторы соединены uplink'),
        test: (t) => (t.links.some((l) => l.kind === 'uplink') ? ok() : no('No switch-to-switch link', 'Нет связи между коммутаторами')),
      },
      { id: 'dual', text: B('Every station is connected to A and B', 'Каждая станция подключена к A и к B'), w: 2, test: (t) => dualAttached(t, stations(t)) },
      { id: 'err', text: B('No errors in Validation', 'Нет ошибок во вкладке «Проверка»'), w: 2, test: noErrors },
    ],
  },
  {
    id: 'ex2-level',
    level: 2,
    title: B('Tank level loop T-101 on the FCP270', 'Контур уровня T-101 на FCP270'),
    brief: [
      B(
        'Continue from exercise 1 (it is loaded for you). Add the I/O for the level loop of tank T-101.',
        'Продолжение задания 1 (оно уже загружено). Добавьте ввод-вывод для контура уровня бака T-101.',
      ),
      B(
        'LT101 is a 4-20 mA level transmitter, range 0…5 m. LV101 is the inlet control valve, 4-20 mA. Choose suitable FBMs, put a Termination Assembly in front of each FBM, wire the instruments and check the signal path with Trace.',
        'LT101 — датчик уровня 4-20 мА, диапазон 0…5 м. LV101 — регулирующий клапан на входе, 4-20 мА. Подберите FBM, перед каждым FBM поставьте клеммную сборку (TA), подключите приборы и проверьте путь сигнала «Трассировкой».',
      ),
    ],
    table: {
      head: ['Tag', 'Type', 'Signal', 'Range'],
      rows: [
        ['LT101', 'Level transmitter', 'AI 4-20 mA', '0…5 m'],
        ['LV101', 'Control valve', 'AO 4-20 mA', '0…100 %'],
      ],
    },
    start: 'base',
    src: '2-60…2-72, 4-14',
    req: [
      { id: 'lt', text: B('LT101 wired, signal reaches a workstation', 'LT101 подключён, сигнал доходит до станции'), w: 2, test: (t) => loopOk(t, 'LT101', ['LT']) },
      { id: 'lv', text: B('LV101 wired, signal path complete', 'LV101 подключён, путь сигнала полный'), w: 2, test: (t) => loopOk(t, 'LV101', ['FV']) },
      { id: 'rng', text: B('LT101 range 0…5', 'Диапазон LT101 0…5'), test: (t) => hasRange(t, 'LT101', 0, 5) },
      {
        id: 'fcp',
        text: B('Both on the FCP270', 'Оба на FCP270'),
        test: (t) => {
          const a = loopOk(t, 'LT101', ['LT'], (c) => c.typeId === 'FCP270')
          return a.ok ? loopOk(t, 'LV101', ['FV'], (c) => c.typeId === 'FCP270') : a
        },
      },
      { id: 'err', text: B('No errors in Validation', 'Нет ошибок во вкладке «Проверка»'), w: 2, test: noErrors },
    ],
  },
  {
    id: 'ex3-zcp',
    level: 2,
    title: B('Temperature loop on a ZCP270', 'Контур температуры на ZCP270'),
    brief: [
      B('A second controller is added: a ZCP270 in the rack room. It has no direct fieldbus.', 'Добавляется второй контроллер: ZCP270 в аппаратной. Прямого fieldbus у него нет.'),
      B(
        'Connect TE301 (RTD, 0…150 °C) and TV301 (steam valve, 4-20 mA) to the ZCP270. The ZCP270 and its FCM100Et must be dual-attached to the network.',
        'Подключите TE301 (термосопротивление, 0…150 °C) и TV301 (паровой клапан, 4-20 мА) к ZCP270. ZCP270 и его FCM100Et подключаются к сети по двум путям.',
      ),
    ],
    table: {
      head: ['Tag', 'Type', 'Signal', 'Range'],
      rows: [
        ['TE301', 'RTD', 'RTD', '0…150 °C'],
        ['TV301', 'Control valve', 'AO 4-20 mA', '0…100 %'],
      ],
    },
    start: 'base',
    src: '2-45…2-56',
    req: [
      {
        id: 'zcp',
        text: B('A ZCP270 with an FCM100Et', 'ZCP270 с FCM100Et'),
        test: (t) => (byType(t, 'ZCP270').length && t.links.some((l) => l.kind === 'host') ? ok() : no('ZCP270 must host an FCM100Et', 'ZCP270 должен обслуживать FCM100Et')),
      },
      { id: 'te', text: B('TE301 is an RTD on the ZCP270', 'TE301 — термосопротивление на ZCP270'), w: 2, test: (t) => loopOk(t, 'TE301', ['TE_RTD'], (c) => c.typeId === 'ZCP270') },
      { id: 'tv', text: B('TV301 on the ZCP270', 'TV301 на ZCP270'), w: 2, test: (t) => loopOk(t, 'TV301', ['FV'], (c) => c.typeId === 'ZCP270') },
      { id: 'dual', text: B('ZCP270 and FCM100Et connected to A and B', 'ZCP270 и FCM100Et подключены к A и B'), test: (t) => dualAttached(t, byType(t, 'ZCP270', 'FCM100Et')) },
      { id: 'err', text: B('No errors in Validation', 'Нет ошибок во вкладке «Проверка»'), w: 2, test: noErrors },
    ],
  },
  {
    id: 'ex4-reactor',
    level: 3,
    title: B('Hardware selection for batch reactor R-401 (FCP280)', 'Подбор железа для batch-реактора R-401 (FCP280)'),
    brief: [
      B(
        'Design the I/O for reactor R-401 on a modern Foxboro DCS: one FCP280, Star network with two root switches (A/B), one engineering and one operator workstation.',
        'Спроектируйте ввод-вывод реактора R-401 на современной Foxboro DCS: один FCP280, сеть Star с двумя root-коммутаторами (A/B), одна инженерная и одна операторская станция.',
      ),
      B(
        'Wire every instrument of the I/O list. Choose FBMs so that every FBM keeps at least 20 % spare channels for future expansion. Use as few FBMs as you can.',
        'Подключите каждый прибор из I/O-листа. Подберите FBM так, чтобы на каждом оставалось не меньше 20 % резервных каналов. Используйте как можно меньше FBM.',
      ),
    ],
    table: {
      head: ['Tag', 'Service', 'Signal', 'Instrument'],
      rows: [
        ['LT401', 'Reactor volume 0…1000 L', 'AI', 'LT'],
        ['TT401', 'Reactor temperature 0…150 °C', 'RTD', 'TE (RTD)'],
        ['TT402', 'Jacket temperature 0…150 °C', 'RTD', 'TE (RTD)'],
        ['PT403', 'Reactor pressure 0…6 bar', 'AI', 'PT'],
        ['FT404', 'Feed A flow', 'AI', 'FT'],
        ['FT405', 'Feed B flow', 'AI', 'FT'],
        ['FV404', 'Feed A valve', 'AO', 'FV'],
        ['FV405', 'Feed B valve', 'AO', 'FV'],
        ['TV402', 'Jacket split-range valve', 'AO', 'FV'],
        ['M407', 'Agitator start', 'DO', 'Pump/motor'],
        ['XV406', 'Discharge valve', 'DO', 'XV'],
        ['YS407', 'Agitator running', 'DI', 'ZS'],
        ['ZSO406', 'Discharge valve open', 'DI', 'ZS'],
      ],
    },
    start: 'empty',
    src: '2-60…2-72',
    req: [
      { id: 'cp', text: B('One FCP280', 'Один FCP280'), test: (t) => (byType(t, 'FCP280').length === 1 ? ok() : no('Exactly one FCP280', 'Нужен ровно один FCP280')) },
      { id: 'ws', text: B('Two H92 workstations (EWS + OWS)', 'Две станции H92 (EWS + OWS)'), test: (t) => (byType(t, 'H92').length >= 2 ? ok() : no('Need two H92', 'Нужны две H92')) },
      {
        id: 'star',
        text: B('Root switches A and B, all stations dual-attached', 'Root-коммутаторы A и B, все станции подключены к обоим'),
        w: 2,
        test: (t) => {
          const roots = byFamily(t, 'switch').filter((s) => s.role === 'root')
          if (!(roots.some((r) => r.side === 'A') && roots.some((r) => r.side === 'B'))) return no('Mark one A and one B switch as root', 'Отметьте коммутаторы A и B как root')
          return dualAttached(t, stations(t))
        },
      },
      ...(
        [
          ['LT401', ['LT']],
          ['TT401', ['TE_RTD']],
          ['TT402', ['TE_RTD']],
          ['PT403', ['PT']],
          ['FT404', ['FT']],
          ['FT405', ['FT']],
          ['FV404', ['FV']],
          ['FV405', ['FV']],
          ['TV402', ['FV']],
          ['M407', ['PUMP']],
          ['XV406', ['XV']],
          ['YS407', ['ZS']],
          ['ZSO406', ['ZS']],
        ] as [string, string[]][]
      ).map(([tag, types]) => ({ id: `io-${tag}`, text: B(`${tag} wired to the FCP280`, `${tag} подключён к FCP280`), test: (t: Topology) => loopOk(t, tag, types, (c) => c.typeId === 'FCP280') })),
      { id: 'spare', text: B('Every FBM keeps ≥ 20 % spare channels', 'На каждом FBM резерв ≥ 20 %'), w: 2, test: (t) => spare(t, 20) },
      {
        id: 'fbms',
        text: B('At most 6 FBMs', 'Не больше 6 FBM'),
        hint: B('FBM204 combines 4 AI and 4 AO; FBM241 combines 8 DI and 8 DO; RTDs need an FBM203.', 'FBM204 совмещает 4 AI и 4 AO; FBM241 — 8 DI и 8 DO; для термосопротивлений нужен FBM203.'),
        test: (t) => (byFamily(t, 'fbm').length >= 1 && byFamily(t, 'fbm').length <= 6 ? ok() : no(`${byFamily(t, 'fbm').length} FBMs used`, `Использовано FBM: ${byFamily(t, 'fbm').length}`)),
      },
      { id: 'err', text: B('No errors in Validation', 'Нет ошибок во вкладке «Проверка»'), w: 2, test: noErrors },
    ],
  },
  {
    id: 'ex5-network',
    level: 4,
    title: B('Plant network without a single point of failure', 'Сеть завода без единой точки отказа'),
    brief: [
      B(
        'The plant has a central control room (CCR) and two field rack rooms. Build a Star (or Inverted Tree) network: two root switches A/B in the CCR and one A/B pair of edge switches in each rack room. Each edge switch has uplinks to both root switches.',
        'На заводе есть центральная операторная (CCR) и две полевые аппаратные. Постройте сеть Star (или Inverted Tree): два root-коммутатора A/B в CCR и по паре edge-коммутаторов A/B в каждой аппаратной. Каждый edge-коммутатор подключается uplink-ами к обоим root-коммутаторам.',
      ),
      B(
        'CCR: 2 operator workstations, 1 engineering workstation, 1 historian server (H91). Each rack room: 2 FCP280. Stations connect to the switches of their own room. No switch failure may isolate any station, and no path may cross more than 7 switches.',
        'CCR: 2 операторские станции, 1 инженерная, 1 сервер истории (H91). В каждой аппаратной: 2 FCP280. Станции подключаются к коммутаторам своего помещения. Отказ любого коммутатора не должен изолировать ни одну станцию, путь не длиннее 7 коммутаторов.',
      ),
    ],
    start: 'empty',
    src: '2-20…2-30',
    req: [
      {
        id: 'sw',
        text: B('6 switches: 2 root + 4 edge', '6 коммутаторов: 2 root + 4 edge'),
        test: (t) => {
          const s = byFamily(t, 'switch')
          return s.filter((x) => x.role === 'root').length === 2 && s.filter((x) => x.role === 'edge').length === 4
            ? ok()
            : no('Set the role (root/edge) of each switch', 'Задайте роль (root/edge) каждого коммутатора')
        },
      },
      {
        id: 'st',
        text: B('3 H92 + 1 H91 + 4 FCP280', '3 H92 + 1 H91 + 4 FCP280'),
        test: (t) => (byType(t, 'H92').length >= 3 && byType(t, 'H91').length >= 1 && byType(t, 'FCP280').length === 4 ? ok() : no('Station count does not match', 'Количество станций не совпадает')),
      },
      {
        id: 'topo',
        text: B('Topology is Star or Inverted Tree', 'Топология Star или Inverted Tree'),
        w: 2,
        test: (t) => {
          const k = analyzeNetwork(t, new Set()).topology
          return k === 'star' || k === 'tree' ? ok() : no(`Detected: ${k}`, `Определено: ${k}`)
        },
      },
      {
        id: 'edge',
        text: B('Controllers are on edge switches only', 'Контроллеры подключены только к edge-коммутаторам'),
        test: (t) => {
          const bad = byType(t, 'FCP280').filter((c) => neighbors(t, c.id, 'mesh').some((s) => s.role !== 'edge'))
          return bad.length ? no(`On a root switch: ${names(bad)}`, `Подключены к root: ${names(bad)}`) : ok()
        },
      },
      { id: 'dual', text: B('All stations dual-attached', 'Все станции подключены к A и B'), test: (t) => dualAttached(t, stations(t)) },
      {
        id: 'spof',
        text: B('No single point of failure, ≤ 7 hops', 'Нет единой точки отказа, ≤ 7 переходов'),
        w: 2,
        test: (t) => {
          const r = analyzeNetwork(t, new Set())
          if (r.spof.length) return no(`Single point of failure: ${names(r.spof.map((s) => s.sw))}`, `Единая точка отказа: ${names(r.spof.map((s) => s.sw))}`)
          return r.maxHops <= 7 ? ok() : no(`${r.maxHops} hops`, `Переходов: ${r.maxHops}`)
        },
      },
      { id: 'err', text: B('No errors in Validation', 'Нет ошибок во вкладке «Проверка»'), w: 2, test: noErrors },
    ],
  },
  {
    id: 'ex6-plant',
    level: 5,
    title: B('Polyethylene plant: project naming convention', 'Завод полиэтилена: правила именования проекта'),
    brief: [
      B(
        'A typical modern project (Foxboro DCS 8.x, FCP280/FDC280) names every station with a 6-character letterbug: area code (letter + digit) + sequence number (2 characters) + equipment code (2 letters).',
        'Типовой современный проект (Foxboro DCS 8.x, FCP280/FDC280) называет каждую станцию letterbug из 6 символов: код зоны (буква + цифра) + порядковый номер (2 символа) + код оборудования (2 буквы).',
      ),
      B(
        'Equipment codes: FC = FCP280, FD = FDC280, EW = engineering workstation, OW = operator workstation, AW = application workstation, HS = historian, SW = PCN switch. Controller numbers go 01…09, then 0A…0Z. Example: C203FC is the third FCP280 in area C2.',
        'Коды оборудования: FC = FCP280, FD = FDC280, EW = инженерная станция, OW = операторская, AW = прикладная станция, HS = сервер истории, SW = коммутатор PCN. Номера контроллеров 01…09, затем 0A…0Z. Пример: C203FC — третий FCP280 в зоне C2.',
      ),
      B(
        'Build: area A2 (central control building) — 2 root switches A/B, 2 OWS, 1 EWS, 1 historian. Area C1 (field rack room) — 2 edge switches A/B, 2 FCP280, 1 FDC280 (for Modbus/OPC UA packages), 1 EWS that will host the controllers of C1. Each edge switch has uplinks to both root switches.',
        'Постройте: зона A2 (центральное здание) — 2 root-коммутатора A/B, 2 OWS, 1 EWS, 1 сервер истории. Зона C1 (полевая аппаратная) — 2 edge-коммутатора A/B, 2 FCP280, 1 FDC280 (для пакетов Modbus/OPC UA), 1 EWS, которая будет хостом контроллеров C1. Каждый edge-коммутатор подключается к обоим root.',
      ),
    ],
    table: {
      head: ['Area', 'Building', 'Equipment'],
      rows: [
        ['A2', 'Central control building', '2 × SW (root A/B), 2 × OW, 1 × EW, 1 × HS'],
        ['C1', 'Field rack room 1', '2 × SW (edge A/B), 2 × FC, 1 × FD, 1 × EW'],
      ],
    },
    start: 'empty',
    req: [
      { id: 'lb', text: B('All letterbugs follow the convention', 'Все letterbug по правилу'), w: 3, test: letterbugConvention },
      {
        id: 'a2',
        text: B('Area A2: 2 OW, 1 EW, 1 HS, 2 root SW', 'Зона A2: 2 OW, 1 EW, 1 HS, 2 root SW'),
        w: 2,
        test: (t) => {
          const a = t.nodes.filter((n) => area(n) === 'A2')
          const c = (code: string) => a.filter((n) => lb(n).endsWith(code)).length
          const roots = a.filter((n) => familyOf(n) === 'switch' && n.role === 'root').length
          return c('OW') >= 2 && c('EW') >= 1 && c('HS') >= 1 && roots === 2
            ? ok()
            : no(`A2 has OW ${c('OW')}, EW ${c('EW')}, HS ${c('HS')}, root SW ${roots}`, `В A2: OW ${c('OW')}, EW ${c('EW')}, HS ${c('HS')}, root SW ${roots}`)
        },
      },
      {
        id: 'c1',
        text: B('Area C1: 2 FC, 1 FD, 1 EW, 2 edge SW', 'Зона C1: 2 FC, 1 FD, 1 EW, 2 edge SW'),
        w: 2,
        test: (t) => {
          const a = t.nodes.filter((n) => area(n) === 'C1')
          const c = (code: string) => a.filter((n) => lb(n).endsWith(code)).length
          const edges = a.filter((n) => familyOf(n) === 'switch' && n.role === 'edge').length
          return c('FC') >= 2 && c('FD') >= 1 && c('EW') >= 1 && edges === 2
            ? ok()
            : no(`C1 has FC ${c('FC')}, FD ${c('FD')}, EW ${c('EW')}, edge SW ${edges}`, `В C1: FC ${c('FC')}, FD ${c('FD')}, EW ${c('EW')}, edge SW ${edges}`)
        },
      },
      {
        id: 'room',
        text: B('Each station is on the switches of its own area', 'Каждая станция подключена к коммутаторам своей зоны'),
        test: (t) => {
          const idx = nodeIndex(t)
          const bad = stations(t).filter((s) => t.links.some((l) => l.kind === 'mesh' && (l.a === s.id || l.b === s.id) && area(idx[otherEnd(l, s.id)]) !== area(s)))
          return bad.length ? no(`Connected to another area: ${names(bad)}`, `Подключены к чужой зоне: ${names(bad)}`) : ok()
        },
      },
      { id: 'dual', text: B('All stations dual-attached', 'Все станции подключены к A и B'), test: (t) => dualAttached(t, stations(t)) },
      { id: 'err', text: B('No errors in Validation', 'Нет ошибок во вкладке «Проверка»'), w: 2, test: noErrors },
    ],
  },
]

export const exercise = (id?: string) => EXERCISES.find((e) => e.id === id)

export interface Grade {
  results: { r: Requirement; res: CheckResult }[]
  score: number
  max: number
  pct: number
}

export function grade(ex: Exercise, t: Topology): Grade {
  const results = ex.req.map((r) => {
    let res: CheckResult
    try {
      res = r.test(t)
    } catch {
      res = no('Check failed', 'Проверка не выполнена')
    }
    return { r, res }
  })
  const max = ex.req.reduce((a, r) => a + (r.w ?? 1), 0)
  const score = results.reduce((a, x) => a + (x.res.ok ? (x.r.w ?? 1) : 0), 0)
  return { results, score, max, pct: Math.round((score / max) * 100) }
}

/** Solved exercise 1: the starting point of exercises 2 and 3. */
export function baseSystem(): Topology {
  const nodes: HwNode[] = [
    { id: 'swA', typeId: 'SW24', x: 380, y: 40, side: 'A', role: 'root', letterbug: 'SWA001' },
    { id: 'swB', typeId: 'SW24', x: 700, y: 40, side: 'B', role: 'root', letterbug: 'SWB001' },
    { id: 'ws1', typeId: 'H92', x: 140, y: 170, letterbug: 'AW0001' },
    { id: 'cp1', typeId: 'FCP270', x: 540, y: 220, letterbug: 'CP0101' },
  ]
  const links = [
    { id: 'b1', a: 'swA', b: 'swB', kind: 'uplink' as const },
    { id: 'b2', a: 'ws1', b: 'swA', kind: 'mesh' as const },
    { id: 'b3', a: 'ws1', b: 'swB', kind: 'mesh' as const },
    { id: 'b4', a: 'cp1', b: 'swA', kind: 'mesh' as const },
    { id: 'b5', a: 'cp1', b: 'swB', kind: 'mesh' as const },
  ]
  return { nodes, links }
}
