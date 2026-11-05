import type { Bilingual } from './catalog'
import type { HwLink, HwNode, Topology } from './model'

export interface Preset {
  id: string
  name: Bilingual
  desc: Bilingual
  build: () => Topology
}

/** Small builder helper for readable preset definitions. */
function builder() {
  const nodes: HwNode[] = []
  const links: HwLink[] = []
  let li = 0
  const n = (id: string, typeId: string, x: number, y: number, extra: Partial<HwNode> = {}) => {
    nodes.push({ id, typeId, x, y, ...extra })
    return id
  }
  const l = (a: string, b: string, kind: HwLink['kind'], extra: Partial<HwLink> = {}) => {
    links.push({ id: `L${++li}`, a, b, kind, ...extra })
  }
  return { nodes, links, n, l }
}

const classic: Preset = {
  id: 'classic',
  name: { en: 'Classic I/A Series V8 (FCP270 + ZCP270)', ru: 'Классическая I/A Series V8 (FCP270 + ZCP270)' },
  desc: {
    en: 'Two redundant root switches (A/B), an engineering workstation, a boot-host server, an FCP270 with a flow loop and a tank level, and a ZCP270 with an FCM100Et for a temperature loop.',
    ru: 'Два резервированных root-коммутатора (A/B), инженерная станция, boot-host сервер, FCP270 с контуром расхода и уровнем резервуара, ZCP270 с FCM100Et для контура температуры.',
  },
  build() {
    const { nodes, links, n, l } = builder()
    n('swA', 'SW24', 380, 40, { side: 'A', role: 'root', letterbug: 'SWA001' })
    n('swB', 'SW24', 700, 40, { side: 'B', role: 'root', letterbug: 'SWB001' })
    l('swA', 'swB', 'uplink')
    n('ws1', 'H92', 120, 150, { letterbug: 'AW0001' })
    n('srv1', 'H91', 960, 150, { letterbug: 'AP0001' })
    n('cp1', 'FCP270', 300, 260, { letterbug: 'CP0101' })
    n('zcp', 'ZCP270', 760, 260, { letterbug: 'CP0201' })
    n('fcm', 'FCM100Et', 960, 330, { letterbug: 'FC0201' })
    for (const s of ['ws1', 'srv1', 'cp1', 'zcp', 'fcm']) {
      l(s, 'swA', 'mesh')
      l(s, 'swB', 'mesh')
    }
    l('fcm', 'zcp', 'host')

    // FCP270 I/O
    n('f1', 'FBM204', 140, 400, { letterbug: 'CP0111' })
    n('f2', 'FBM241', 420, 400, { letterbug: 'CP0112' })
    l('f1', 'cp1', 'fieldbus')
    l('f2', 'cp1', 'fieldbus')
    n('ta1', 'TA', 140, 500)
    n('ta2', 'TA', 420, 500)
    l('f1', 'ta1', 'tacable')
    l('f2', 'ta2', 'tacable')
    n('ft101', 'FT', 40, 610, { tag: 'FT101', lo: 0, hi: 100, eu: 'm3/h' })
    n('lt102', 'LT', 170, 610, { tag: 'LT102', lo: 0, hi: 5, eu: 'm' })
    n('fv101', 'FV', 300, 610, { tag: 'FV101', lo: 0, hi: 100, eu: '%' })
    n('p103', 'PUMP', 420, 610, { tag: 'P103' })
    n('zs103', 'ZS', 540, 610, { tag: 'YS103' })
    l('ta1', 'ft101', 'field', { channel: 1, signal: 'AI' })
    l('ta1', 'lt102', 'field', { channel: 2, signal: 'AI' })
    l('ta1', 'fv101', 'field', { channel: 5, signal: 'AO' })
    l('ta2', 'p103', 'field', { channel: 9, signal: 'DO' })
    l('ta2', 'zs103', 'field', { channel: 1, signal: 'DI' })

    // ZCP270 I/O via FCM
    n('f3', 'FBM202', 820, 450, { letterbug: 'FC0211' })
    n('f4', 'FBM237', 1060, 450, { letterbug: 'FC0212' })
    l('f3', 'fcm', 'fieldbus')
    l('f4', 'fcm', 'fieldbus')
    n('ta3', 'TA', 820, 540)
    n('ta4', 'TA', 1060, 540)
    l('f3', 'ta3', 'tacable')
    l('f4', 'ta4', 'tacable')
    n('te201', 'TE_TC', 800, 640, { tag: 'TE201', lo: 0, hi: 200, eu: 'degC' })
    n('tv201', 'FV', 1060, 640, { tag: 'TV201', lo: 0, hi: 100, eu: '%' })
    l('ta3', 'te201', 'field', { channel: 1, signal: 'TC' })
    l('ta4', 'tv201', 'field', { channel: 1, signal: 'AO' })
    return { nodes, links }
  },
}

const modernPharma: Preset = {
  id: 'pharma',
  name: { en: 'Foxboro DCS: pharma bioreactor (FCP280, Star)', ru: 'Foxboro DCS: фарма-биореактор (FCP280, Star)' },
  desc: {
    en: 'Star topology with two root switches and two edge switches. An FCP280 controls a bioreactor: jacket temperature (RTD), pH, dissolved oxygen, jacket valve, base-dosing pump and an air sparge on/off valve.',
    ru: 'Топология Star: два root- и два edge-коммутатора. FCP280 управляет биореактором: температура рубашки (RTD), pH, растворённый кислород, клапан рубашки, насос дозирования щёлочи и клапан подачи воздуха.',
  },
  build() {
    const { nodes, links, n, l } = builder()
    n('rA', 'SWCH', 420, 30, { side: 'A', role: 'root', letterbug: 'ROOTA1' })
    n('rB', 'SWCH', 720, 30, { side: 'B', role: 'root', letterbug: 'ROOTB1' })
    n('eA', 'SW24', 300, 150, { side: 'A', role: 'edge', letterbug: 'EDGEA1' })
    n('eB', 'SW24', 840, 150, { side: 'B', role: 'edge', letterbug: 'EDGEB1' })
    l('rA', 'rB', 'uplink')
    for (const e of ['eA', 'eB']) {
      l(e, 'rA', 'uplink')
      l(e, 'rB', 'uplink')
    }
    n('ws1', 'H92', 60, 250, { letterbug: 'OP0001' })
    n('ws2', 'H92', 300, 250, { letterbug: 'EN0001' })
    n('srv', 'H90', 1040, 250, { letterbug: 'GR0001', note: 'Galaxy Repository' })
    n('cp', 'FCP280', 640, 270, { letterbug: 'CP2801' })
    for (const s of ['ws1', 'ws2', 'srv', 'cp']) {
      l(s, 'eA', 'mesh')
      l(s, 'eB', 'mesh')
    }
    n('f1', 'FBM203', 380, 400, { letterbug: 'CP2811' })
    n('f2', 'FBM204', 640, 400, { letterbug: 'CP2812' })
    n('f3', 'FBM241', 900, 400, { letterbug: 'CP2813' })
    for (const f of ['f1', 'f2', 'f3']) l(f, 'cp', 'fieldbus')
    n('ta1', 'TA', 380, 500)
    n('ta2', 'TA', 640, 500)
    n('ta3', 'TA', 900, 500)
    l('f1', 'ta1', 'tacable')
    l('f2', 'ta2', 'tacable')
    l('f3', 'ta3', 'tacable')
    n('tt', 'TE_RTD', 330, 610, { tag: 'TT301', lo: 0, hi: 60, eu: 'degC' })
    n('ph', 'AT', 520, 610, { tag: 'AT302', lo: 2, hi: 12, eu: 'pH' })
    n('do', 'AT', 640, 610, { tag: 'AT303', lo: 0, hi: 100, eu: '%sat' })
    n('tv', 'FV', 760, 610, { tag: 'TV301', lo: 0, hi: 100, eu: '%' })
    n('pmp', 'PUMP', 880, 610, { tag: 'P302' })
    n('xv', 'XV', 1000, 610, { tag: 'XV303' })
    l('ta1', 'tt', 'field', { channel: 1, signal: 'RTD' })
    l('ta2', 'ph', 'field', { channel: 1, signal: 'AI' })
    l('ta2', 'do', 'field', { channel: 2, signal: 'AI' })
    l('ta2', 'tv', 'field', { channel: 5, signal: 'AO' })
    l('ta3', 'pmp', 'field', { channel: 9, signal: 'DO' })
    l('ta3', 'xv', 'field', { channel: 10, signal: 'DO' })
    return { nodes, links }
  },
}

const broken: Preset = {
  id: 'broken',
  name: { en: 'Troubleshooting exercise: find the design errors', ru: 'Упражнение: найдите ошибки проекта' },
  desc: {
    en: 'A deliberately flawed design: single-attached stations, a three-switch linear chain, an FBM with a wrong letterbug and a ZCP270 without an FCM. Fix every error in the Validation tab.',
    ru: 'Специально испорченный проект: станции с одним подключением, линейная цепочка из трёх коммутаторов, FBM с неверным letterbug и ZCP270 без FCM. Исправьте все ошибки во вкладке Validation.',
  },
  build() {
    const { nodes, links, n, l } = builder()
    n('s1', 'SW8', 200, 40, { side: 'A', letterbug: 'SW0001' })
    n('s2', 'SW8', 500, 40, { side: 'A', letterbug: 'SW0002' })
    n('s3', 'SW8', 800, 40, { side: 'B', letterbug: 'SW0003' })
    l('s1', 's2', 'uplink')
    l('s2', 's3', 'uplink')
    n('ws', 'H92', 120, 200, { letterbug: 'AW0001' })
    l('ws', 's1', 'mesh')
    n('cp', 'FCP270', 500, 200, { letterbug: 'CP0101' })
    l('cp', 's2', 'mesh')
    n('z', 'ZCP270', 820, 200, { letterbug: 'CP0201' })
    l('z', 's3', 'mesh')
    n('f1', 'FBM201', 420, 340, { letterbug: 'XX0111' })
    l('f1', 'cp', 'fieldbus')
    n('f2', 'FBM204', 620, 340, { letterbug: 'CP0101' })
    l('f2', 'cp', 'fieldbus')
    n('ta', 'TA', 420, 440)
    l('f1', 'ta', 'tacable')
    n('ft', 'FT', 420, 540, { tag: 'FT001', lo: 0, hi: 50, eu: 'm3/h' })
    l('ta', 'ft', 'field', { channel: 1, signal: 'AI' })
    n('lt', 'LT', 620, 540, {})
    return { nodes, links: links.filter((x) => nodes.some((nn) => nn.id === x.a) && nodes.some((nn) => nn.id === x.b)) }
  },
}

const empty: Preset = {
  id: 'empty',
  name: { en: 'Empty canvas', ru: 'Пустой холст' },
  desc: { en: 'Start from scratch.', ru: 'Начать с нуля.' },
  build: () => ({ nodes: [], links: [] }),
}

export const PRESETS: Preset[] = [classic, modernPharma, broken, empty]
