import type { Bilingual } from './catalog'
import { SIGNAL_LABEL } from './catalog'
import { familyOf, fbmController, fbmHost, linksOf, neighbors, nodeIndex, nodeName, typeOf, type HwNode, type Topology } from './model'
import { ethernetPath } from './network'

export interface TraceStep {
  nodeId?: string
  /** physical / logical layer */
  layer: 'field' | 'io' | 'network' | 'control' | 'hmi'
  title: string
  detail: Bilingual
  ok: boolean
}

export interface TraceResult {
  steps: TraceStep[]
  /** node ids along the path for highlighting */
  nodeIds: string[]
  broken: boolean
}

/**
 * Trace the signal path of a field instrument:
 * instrument → TA → FBM (channel) → FCM/FCP → MESH switches → CP (ECB → AIN/AOUT block) → workstation (FoxView).
 */
export function traceSignal(t: Topology, instId: string, failed: Set<string>): TraceResult {
  const byId = nodeIndex(t)
  const inst = byId[instId]
  const steps: TraceStep[] = []
  const ids: string[] = []
  let broken = false
  const push = (s: TraceStep) => {
    if (failed.has(s.nodeId ?? '')) s.ok = false
    if (!s.ok) broken = true
    steps.push(s)
    if (s.nodeId) ids.push(s.nodeId)
  }
  if (!inst || familyOf(inst) !== 'instrument') return { steps, nodeIds: ids, broken: true }
  const it = typeOf(inst)
  const out = !!it.isOutput
  const range = inst.lo !== undefined && inst.hi !== undefined ? ` ${inst.lo}–${inst.hi} ${inst.eu ?? ''}` : ''

  push({
    nodeId: inst.id,
    layer: 'field',
    title: `${inst.tag ?? it.label}`,
    detail: out
      ? { en: `Final element (${SIGNAL_LABEL[it.signal!]}).${range}`, ru: `Исполнительный элемент (${SIGNAL_LABEL[it.signal!]}).${range}` }
      : { en: `Field sensor (${SIGNAL_LABEL[it.signal!]}).${range}`, ru: `Полевой датчик (${SIGNAL_LABEL[it.signal!]}).${range}` },
    ok: true,
  })

  const fl = linksOf(t, inst.id, 'field')[0]
  const ta = fl ? byId[fl.a === inst.id ? fl.b : fl.a] : undefined
  if (!ta) {
    push({ layer: 'field', title: 'TA', detail: { en: 'Not wired to a Termination Assembly.', ru: 'Не подключён к клеммной сборке.' }, ok: false })
    return { steps, nodeIds: ids, broken }
  }
  push({ nodeId: ta.id, layer: 'field', title: 'Termination Assembly', detail: { en: `Field wires land on terminal for channel ${fl.channel}.`, ru: `Полевые провода на клеммах канала ${fl.channel}.` }, ok: true })

  const fbm = neighbors(t, ta.id, 'tacable')[0]
  if (!fbm) {
    push({ layer: 'io', title: 'FBM', detail: { en: 'TA is not cabled to an FBM.', ru: 'TA не подключена к FBM.' }, ok: false })
    return { steps, nodeIds: ids, broken }
  }
  push({
    nodeId: fbm.id,
    layer: 'io',
    title: `${typeOf(fbm).label} ${fbm.letterbug ?? ''}`,
    detail: out
      ? { en: `Channel ${fl.channel}: converts the digital output value into ${SIGNAL_LABEL[it.signal!]}; holds fail-safe value on comm loss.`, ru: `Канал ${fl.channel}: преобразует цифровое значение в ${SIGNAL_LABEL[it.signal!]}; при потере связи — fail-safe значение.` }
      : { en: `Channel ${fl.channel}: converts ${SIGNAL_LABEL[it.signal!]} to a digital value (raw counts).`, ru: `Канал ${fl.channel}: преобразует ${SIGNAL_LABEL[it.signal!]} в цифровое значение (raw counts).` },
    ok: true,
  })

  const host = fbmHost(t, fbm.id)
  const cp = fbmController(t, fbm.id)
  if (!host || !cp) {
    push({ layer: 'io', title: 'Fieldbus', detail: { en: 'FBM has no path to a control processor.', ru: 'У FBM нет пути к контроллеру.' }, ok: false })
    return { steps, nodeIds: ids, broken }
  }
  if (familyOf(host) === 'fcm') {
    push({ nodeId: host.id, layer: 'io', title: `FCM100Et ${host.letterbug ?? ''}`, detail: { en: '2 Mbps module fieldbus → 100 Mbps MESH.', ru: 'Fieldbus 2 Мбит/с → MESH 100 Мбит/с.' }, ok: true })
    const p = ethernetPath(t, failed, host.id, cp.id)
    if (!p) push({ layer: 'network', title: 'MESH', detail: { en: `No MESH path from FCM to ${nodeName(cp)}.`, ru: `Нет пути по MESH от FCM до ${nodeName(cp)}.` }, ok: false })
    else
      for (const id of p.slice(1, -1))
        push({ nodeId: id, layer: 'network', title: `${nodeName(byId[id])} (side ${byId[id].side ?? '?'})`, detail: { en: 'MESH switch hop', ru: 'Переход через коммутатор MESH' }, ok: true })
  } else {
    push({ layer: 'io', title: 'Module fieldbus 2 Mbps', detail: { en: `${typeOf(cp).label} polls the FBM directly (redundant paths A/B).`, ru: `${typeOf(cp).label} опрашивает FBM напрямую (резервированные пути A/B).` }, ok: true })
  }

  const blk = out ? (it.signal === 'DO' ? 'DOUT / MOVLV' : 'AOUT') : it.signal === 'DI' ? 'DIN' : 'AIN'
  push({
    nodeId: cp.id,
    layer: 'control',
    title: `${typeOf(cp).label} ${cp.letterbug ?? ''}`,
    detail: out
      ? { en: `Controller block (e.g. PID) → ${blk} block (${inst.tag ?? ''}) converts EU to output → ECB (${fbm.letterbug}) → FBM.`, ru: `Блок регулятора (например PID) → блок ${blk} (${inst.tag ?? ''}) переводит EU в выход → ECB (${fbm.letterbug}) → FBM.` }
      : { en: `ECB (${fbm.letterbug}) polls the FBM → ${blk} block (${inst.tag ?? ''}) converts raw counts to engineering units, checks BAD/OOR → PID/alarms.`, ru: `ECB (${fbm.letterbug}) опрашивает FBM → блок ${blk} (${inst.tag ?? ''}) переводит raw counts в инженерные единицы, проверяет BAD/OOR → PID/аварии.` },
    ok: true,
  })

  // to a workstation
  const wss = t.nodes.filter((n) => familyOf(n) === 'workstation' && !failed.has(n.id))
  let best: string[] | undefined
  let ws: HwNode | undefined
  for (const w of wss) {
    const p = ethernetPath(t, failed, cp.id, w.id)
    if (p && (!best || p.length < best.length)) (best = p), (ws = w)
  }
  if (!best || !ws) {
    push({ layer: 'hmi', title: 'Workstation', detail: { en: 'No reachable workstation: the operator cannot see this point.', ru: 'Нет доступной рабочей станции: оператор не видит эту точку.' }, ok: false })
    return { steps, nodeIds: ids, broken }
  }
  for (const id of best.slice(1, -1))
    push({ nodeId: id, layer: 'network', title: `${nodeName(byId[id])} (side ${byId[id].side ?? '?'})`, detail: { en: 'MESH switch hop', ru: 'Переход через коммутатор MESH' }, ok: true })
  push({
    nodeId: ws.id,
    layer: 'hmi',
    title: `${typeOf(ws).label} ${ws.letterbug ?? ''}`,
    detail: { en: 'Displayed on faceplate / detail display / trend (FoxView or Control HMI).', ru: 'Отображается на faceplate / detail display / тренде (FoxView или Control HMI).' },
    ok: true,
  })
  return { steps, nodeIds: ids, broken }
}
