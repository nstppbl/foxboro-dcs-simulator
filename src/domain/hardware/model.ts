import { CATALOG_BY_ID, signalCompatible, type Bilingual, type ComponentType, type Family, type SignalType } from './catalog'

export type SwitchSide = 'A' | 'B'

export interface HwNode {
  id: string
  typeId: string
  x: number
  y: number
  /** 6-char station/module identifier (stations, FCMs, FBMs) */
  letterbug?: string
  /** Instrument tag, e.g. FT101 */
  tag?: string
  /** Switch network side (A or B) */
  side?: SwitchSide
  /** Switch role, informational */
  role?: 'root' | 'edge'
  /** Instrument engineering range */
  lo?: number
  hi?: number
  eu?: string
  /** Free text note */
  note?: string
}

/**
 * Link kinds (always stored "upstream → downstream" order is not required;
 * use `otherEnd` helpers):
 *  - mesh:     station (workstation/server/controller/fcm) ↔ switch
 *  - uplink:   switch ↔ switch
 *  - fieldbus: FBM ↔ FCP270/FCP280/FCM100Et (2 Mbps module fieldbus)
 *  - host:     FCM100Et ↔ ZCP270 (logical: the ZCP270 hosts the FCM)
 *  - tacable:  FBM ↔ Termination Assembly
 *  - field:    TA ↔ instrument (on a channel)
 */
export type LinkKind = 'mesh' | 'uplink' | 'fieldbus' | 'host' | 'tacable' | 'field'

export interface HwLink {
  id: string
  a: string
  b: string
  kind: LinkKind
  /** field links: FBM channel number (1-based) */
  channel?: number
  /** field links: signal type of the channel */
  signal?: SignalType
}

export interface Topology {
  nodes: HwNode[]
  links: HwLink[]
}

export const typeOf = (n: HwNode): ComponentType => CATALOG_BY_ID[n.typeId]
export const familyOf = (n: HwNode): Family => typeOf(n).family

export const STATION_FAMILIES: Family[] = ['workstation', 'server', 'controller', 'fcm']
export const isStation = (n: HwNode) => STATION_FAMILIES.includes(familyOf(n))

export function nodeName(n: HwNode): string {
  return n.tag || n.letterbug || typeOf(n).label
}

export function otherEnd(l: HwLink, id: string): string {
  return l.a === id ? l.b : l.a
}

export function linksOf(t: Topology, id: string, kind?: LinkKind): HwLink[] {
  return t.links.filter((l) => (l.a === id || l.b === id) && (!kind || l.kind === kind))
}

export function neighbors(t: Topology, id: string, kind?: LinkKind): HwNode[] {
  const byId = nodeIndex(t)
  return linksOf(t, id, kind)
    .map((l) => byId[otherEnd(l, id)])
    .filter(Boolean)
}

export function nodeIndex(t: Topology): Record<string, HwNode> {
  return Object.fromEntries(t.nodes.map((n) => [n.id, n]))
}

/** The module-fieldbus host of an FBM (FCP270/FCP280 or FCM100Et). */
export function fbmHost(t: Topology, fbmId: string): HwNode | undefined {
  return neighbors(t, fbmId, 'fieldbus')[0]
}

/** The control processor that owns an FBM's I/O (through FCM if needed). */
export function fbmController(t: Topology, fbmId: string): HwNode | undefined {
  const host = fbmHost(t, fbmId)
  if (!host) return undefined
  if (familyOf(host) === 'controller') return host
  return neighbors(t, host.id, 'host')[0]
}

/** FBM channels already used by field links. */
export function usedChannels(t: Topology, fbmId: string): HwLink[] {
  const ta = neighbors(t, fbmId, 'tacable')[0]
  if (!ta) return []
  return linksOf(t, ta.id, 'field')
}

/** Expand channel groups into a 1-based channel → signal list. */
export function channelMap(type: ComponentType): SignalType[] {
  const out: SignalType[] = []
  for (const g of type.channels ?? []) for (let i = 0; i < g.count; i++) out.push(g.signal)
  return out
}

export function freeChannelFor(t: Topology, fbm: HwNode, signal: SignalType): number | undefined {
  const map = channelMap(typeOf(fbm))
  const used = new Set(usedChannels(t, fbm.id).map((l) => l.channel))
  for (let i = 0; i < map.length; i++) {
    if (!used.has(i + 1) && signalCompatible(map[i], signal)) return i + 1
  }
  return undefined
}

export interface ConnectResult {
  ok: boolean
  kind?: LinkKind
  /** ordered so that `a` is the first argument passed */
  channel?: number
  signal?: SignalType
  reason?: Bilingual
}

const R = (en: string, ru: string): Bilingual => ({ en, ru })

/** Decide whether two nodes may be wired together and what the link is. */
export function canConnect(t: Topology, a: HwNode, b: HwNode): ConnectResult {
  if (a.id === b.id) return { ok: false, reason: R('Cannot connect a node to itself.', 'Нельзя соединить узел сам с собой.') }
  const exists = t.links.some((l) => (l.a === a.id && l.b === b.id) || (l.a === b.id && l.b === a.id))
  if (exists) return { ok: false, reason: R('These nodes are already connected.', 'Эти узлы уже соединены.') }

  const fa = familyOf(a)
  const fb = familyOf(b)
  const pair = (x: Family, y: Family) => (fa === x && fb === y) || (fa === y && fb === x)
  const pick = (f: Family) => (fa === f ? a : b)

  // Ethernet: stations to switches
  if (fa === 'switch' && fb === 'switch') return { ok: true, kind: 'uplink' }
  if ((fa === 'switch' && STATION_FAMILIES.includes(fb)) || (fb === 'switch' && STATION_FAMILIES.includes(fa))) {
    const sw = pick('switch')
    const port = typeOf(sw).ports ?? 8
    if (linksOf(t, sw.id).length >= port) return { ok: false, reason: R(`Switch has no free ports (${port}).`, `У коммутатора нет свободных портов (${port}).`) }
    return { ok: true, kind: 'mesh' }
  }

  // FBM to its fieldbus host
  if (pair('fbm', 'controller') || pair('fbm', 'fcm')) {
    const fbm = pick('fbm')
    const host = fa === 'fbm' ? b : a
    const ht = typeOf(host)
    if (ht.family === 'controller' && !ht.directFieldbus) {
      if (ht.id === 'ZCP270')
        return { ok: false, reason: R('ZCP270 cannot talk to FBMs directly. Connect the FBM to an FCM100Et, and the FCM100Et to the ZCP270.', 'ZCP270 не работает с FBM напрямую. Подключите FBM к FCM100Et, а FCM100Et к ZCP270.') }
      return { ok: false, reason: R(`${ht.label} does not use FBMs (it integrates Ethernet/serial devices).`, `${ht.label} не использует FBM (он подключает Ethernet/serial устройства).`) }
    }
    if (fbmHost(t, fbm.id)) return { ok: false, reason: R('This FBM already has a fieldbus host.', 'У этого FBM уже есть хост fieldbus.') }
    const count = neighbors(t, host.id, 'fieldbus').length
    if (ht.maxFbms !== undefined && count >= ht.maxFbms)
      return { ok: false, reason: R(`${ht.label} supports at most ${ht.maxFbms} FBMs on its fieldbus.`, `${ht.label} поддерживает не более ${ht.maxFbms} FBM.`) }
    return { ok: true, kind: 'fieldbus' }
  }

  // FCM hosted by ZCP270
  if (pair('fcm', 'controller')) {
    const cp = pick('controller')
    if (cp.typeId !== 'ZCP270') return { ok: false, reason: R('An FCM100Et is hosted only by a ZCP270.', 'FCM100Et может обслуживаться только ZCP270.') }
    const fcm = pick('fcm')
    if (neighbors(t, fcm.id, 'host').length) return { ok: false, reason: R('This FCM already has a host ZCP270.', 'У этого FCM уже есть ZCP270.') }
    if (neighbors(t, cp.id, 'host').length >= 64) return { ok: false, reason: R('ZCP270 supports at most 32 FCM100Et pairs.', 'ZCP270 поддерживает не более 32 пар FCM100Et.') }
    return { ok: true, kind: 'host' }
  }

  // FBM ↔ TA (one each)
  if (pair('fbm', 'ta')) {
    const fbm = pick('fbm')
    const ta = pick('ta')
    if (neighbors(t, fbm.id, 'tacable').length) return { ok: false, reason: R('This FBM already has a Termination Assembly.', 'У этого FBM уже есть клеммная сборка.') }
    if (neighbors(t, ta.id, 'tacable').length) return { ok: false, reason: R('This TA is already cabled to an FBM.', 'Эта TA уже подключена к FBM.') }
    return { ok: true, kind: 'tacable' }
  }

  // TA ↔ instrument (on a channel)
  if (pair('ta', 'instrument')) {
    const ta = pick('ta')
    const inst = pick('instrument')
    if (neighbors(t, inst.id, 'field').length) return { ok: false, reason: R('This instrument is already wired.', 'Этот прибор уже подключён.') }
    const fbm = neighbors(t, ta.id, 'tacable')[0]
    if (!fbm) return { ok: false, reason: R('Cable the TA to an FBM first.', 'Сначала подключите TA к FBM.') }
    const sig = typeOf(inst).signal!
    const ch = freeChannelFor(t, fbm, sig)
    if (!ch) return { ok: false, reason: R(`${typeOf(fbm).label} has no free channel for a ${sig} signal.`, `У ${typeOf(fbm).label} нет свободного канала для сигнала ${sig}.`) }
    return { ok: true, kind: 'field', channel: ch, signal: sig }
  }

  if (pair('fbm', 'instrument'))
    return { ok: false, reason: R('Field wiring lands on a Termination Assembly, not on the FBM. Add a TA between them.', 'Полевые кабели подключаются к клеммной сборке (TA), а не к FBM. Добавьте TA.') }

  return { ok: false, reason: R(`A ${typeOf(a).label} cannot be connected to a ${typeOf(b).label}.`, `${typeOf(a).label} нельзя соединить с ${typeOf(b).label}.`) }
}
