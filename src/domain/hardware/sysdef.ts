/**
 * System Definition: the "main configuration" of a Foxboro system (manual ch. 14; SysDef / System
 * Definition software in modern Foxboro DCS). It sits on top of the hardware topology and says which
 * workstation hosts each controller (checkpoint, boot image), how stations are grouped into System
 * Monitor (SMON) domains, which workstations get system alarms, and which software each station runs.
 * Check Configuration validates it; Commit freezes it into the configuration that is installed.
 */
import type { Bilingual } from './catalog'
import { familyOf, nodeIndex, typeOf, type HwNode, type Topology } from './model'
import { ethernetPath } from './network'

export type StationRole = 'EWS' | 'OWS' | 'AW' | 'HIST'

export interface Smon {
  id: string
  /** 6-char SMON name, e.g. SMON01 */
  name: string
  /** workstation node id that runs this system monitor */
  host?: string
  /** station node ids monitored by this SMON */
  members: string[]
  /** workstations that get this domain's system alarms (max 6) */
  notify: string[]
}

export interface SysDef {
  /** controller node id → host workstation/server node id */
  hosts: Record<string, string>
  /** workstation/server node id → role */
  roles: Record<string, StationRole>
  smons: Smon[]
  /** node id → software packages */
  software: Record<string, string[]>
  committed?: { at: number; sig: string; report: string; n: number }
}

export const emptySysDef = (): SysDef => ({ hosts: {}, roles: {}, smons: [], software: {} })

export const SOFTWARE: { id: string; label: string; roles: StationRole[] | 'controller' }[] = [
  { id: 'CCS', label: 'Control Core Services', roles: ['EWS', 'OWS', 'AW', 'HIST'] },
  { id: 'CS', label: 'Foxboro DCS Control Software (Control Editors)', roles: ['EWS'] },
  { id: 'HMI', label: 'Control HMI / FoxView', roles: ['EWS', 'OWS'] },
  { id: 'SYSMGR', label: 'System Manager', roles: ['EWS', 'OWS'] },
  { id: 'SYSDEF', label: 'System Definition', roles: ['EWS'] },
  { id: 'FDM', label: 'Field Device Manager (HART)', roles: ['EWS'] },
  { id: 'HIST', label: 'Historian', roles: ['HIST'] },
  { id: 'OPCUA', label: 'OPC UA Server', roles: ['AW'] },
  { id: 'BACKUP', label: 'System Recovery (backup)', roles: ['EWS', 'OWS', 'AW', 'HIST'] },
]

/** Packages a role needs at least. */
export const REQUIRED: Record<StationRole, string[]> = { EWS: ['CCS', 'CS', 'HMI', 'SYSMGR', 'SYSDEF'], OWS: ['CCS', 'HMI', 'SYSMGR'], AW: ['CCS'], HIST: ['CCS', 'HIST'] }

export const ROLE_LABEL: Record<StationRole, Bilingual> = {
  EWS: { en: 'Engineering workstation', ru: 'Инженерная станция' },
  OWS: { en: 'Operator workstation', ru: 'Операторская станция' },
  AW: { en: 'Application workstation', ru: 'Прикладная станция' },
  HIST: { en: 'Historian server', ru: 'Сервер истории' },
}

export const isController = (n: HwNode) => familyOf(n) === 'controller'
export const isPc = (n: HwNode) => familyOf(n) === 'workstation' || familyOf(n) === 'server'
/** Stations that belong to a System Monitor domain. */
export const isMonitored = (n: HwNode) => ['workstation', 'server', 'controller', 'fcm', 'switch'].includes(familyOf(n))

/** Role from the letterbug equipment code (…EW, …OW, …AW, …HS), else default by hardware. */
export function guessRole(n: HwNode): StationRole {
  const code = (n.letterbug ?? '').toUpperCase().slice(4)
  if (code === 'EW') return 'EWS'
  if (code === 'OW') return 'OWS'
  if (code === 'AW') return 'AW'
  if (code === 'HS') return 'HIST'
  return familyOf(n) === 'server' ? 'HIST' : 'EWS'
}

export const roleOf = (sd: SysDef, n: HwNode): StationRole => sd.roles[n.id] ?? guessRole(n)

export interface SdIssue {
  severity: 'error' | 'warning' | 'info'
  text: Bilingual
  nodes: string[]
}

export const SMON_MAX_STATIONS = 64
export const SMON_MAX_NOTIFY = 6
export const SMON_MAX = 30
export const HOST_MAX_CP = 30

/** Check Configuration. */
export function checkSysDef(t: Topology, sd: SysDef): SdIssue[] {
  const out: SdIssue[] = []
  const add = (severity: SdIssue['severity'], nodes: string[], en: string, ru: string) => out.push({ severity, nodes, text: { en, ru } })
  const idx = nodeIndex(t)
  const name = (id: string) => idx[id]?.letterbug || (idx[id] ? typeOf(idx[id]).label : '?')
  const cps = t.nodes.filter(isController)
  const pcs = t.nodes.filter(isPc)

  if (!pcs.length) add('error', [], 'No workstation or server: nothing can host the controllers.', 'Нет рабочих станций и серверов: контроллеры некому хостить.')

  // letterbugs
  for (const n of t.nodes.filter(isMonitored))
    if (!/^[A-Z0-9]{6}$/.test((n.letterbug ?? '').toUpperCase()))
      add('error', [n.id], `${typeOf(n).label} has no valid 6-character letterbug.`, `У ${typeOf(n).label} нет корректного letterbug из 6 символов.`)

  // hosts
  const hostLoad = new Map<string, number>()
  for (const cp of cps) {
    const h = sd.hosts[cp.id]
    if (!h || !idx[h]) {
      add(
        'error',
        [cp.id],
        `${name(cp.id)}: no host workstation assigned (it keeps the checkpoint file and boot image).`,
        `${name(cp.id)}: не назначен host (на нём checkpoint-файл и образ загрузки).`,
      )
      continue
    }
    hostLoad.set(h, (hostLoad.get(h) ?? 0) + 1)
    if (!isPc(idx[h])) add('error', [cp.id, h], `${name(cp.id)}: the host must be a workstation or server.`, `${name(cp.id)}: host должен быть рабочей станцией или сервером.`)
    else if (!ethernetPath(t, new Set(), cp.id, h))
      add('error', [cp.id, h], `${name(cp.id)} cannot reach its host ${name(h)} over the control network.`, `${name(cp.id)} не видит свой host ${name(h)} по сети управления.`)
    else if (roleOf(sd, idx[h]) === 'OWS')
      add(
        'warning',
        [cp.id, h],
        `${name(cp.id)} is hosted by an operator workstation; hosts are normally engineering workstations or servers.`,
        `${name(cp.id)} хостится операторской станцией; обычно host — инженерная станция или сервер.`,
      )
  }
  for (const [h, n] of hostLoad)
    if (n > HOST_MAX_CP) add('warning', [h], `${name(h)} hosts ${n} controllers (recommended ≤ ${HOST_MAX_CP}).`, `${name(h)} хостит ${n} контроллеров (рекомендуется ≤ ${HOST_MAX_CP}).`)

  // SMON domains
  if (!sd.smons.length) add('error', [], 'No System Monitor domain: station health would not be monitored.', 'Нет доменов System Monitor: состояние станций никто не контролирует.')
  if (sd.smons.length > SMON_MAX) add('error', [], `More than ${SMON_MAX} System Monitors in one network.`, `Больше ${SMON_MAX} System Monitor в одной сети.`)
  const seenName = new Set<string>()
  for (const sm of sd.smons) {
    if (!/^[A-Z0-9]{6}$/.test(sm.name)) add('error', [], `SMON "${sm.name}": the name must be 6 characters A-Z/0-9.`, `SMON «${sm.name}»: имя должно быть из 6 символов A-Z/0-9.`)
    if (seenName.has(sm.name)) add('error', [], `Duplicate SMON name ${sm.name}.`, `Повторяющееся имя SMON ${sm.name}.`)
    seenName.add(sm.name)
    if (!sm.host || !idx[sm.host]) add('error', [], `${sm.name}: no host workstation.`, `${sm.name}: не задана станция-host.`)
    else if (roleOf(sd, idx[sm.host]) !== 'EWS')
      add(
        'warning',
        [sm.host],
        `${sm.name} is hosted by ${name(sm.host)}; System Monitors normally run on an engineering workstation.`,
        `${sm.name} работает на ${name(sm.host)}; обычно System Monitor запускают на инженерной станции.`,
      )
    if (sm.members.length > SMON_MAX_STATIONS)
      add('error', [], `${sm.name} monitors ${sm.members.length} stations (max ${SMON_MAX_STATIONS}).`, `${sm.name} контролирует ${sm.members.length} станций (максимум ${SMON_MAX_STATIONS}).`)
    if (!sm.notify.length) add('warning', [], `${sm.name}: no notification workstation, so nobody sees its system alarms.`, `${sm.name}: нет станций уведомления, системные аварии никто не увидит.`)
    if (sm.notify.length > SMON_MAX_NOTIFY) add('error', [], `${sm.name}: at most ${SMON_MAX_NOTIFY} notification workstations.`, `${sm.name}: не больше ${SMON_MAX_NOTIFY} станций уведомления.`)
    for (const w of sm.notify)
      if (idx[w] && familyOf(idx[w]) !== 'workstation')
        add('error', [w], `${sm.name}: ${name(w)} is not a workstation and cannot show alarms.`, `${sm.name}: ${name(w)} — не рабочая станция и не может показывать аварии.`)
  }
  const domainOf = new Map<string, string[]>()
  for (const sm of sd.smons) for (const m of sm.members) domainOf.set(m, [...(domainOf.get(m) ?? []), sm.name])
  for (const n of t.nodes.filter(isMonitored)) {
    const d = domainOf.get(n.id) ?? []
    if (!d.length) add('error', [n.id], `${name(n.id)} is not in any System Monitor domain.`, `${name(n.id)} не входит ни в один домен System Monitor.`)
    if (d.length > 1) add('error', [n.id], `${name(n.id)} is in several domains (${d.join(', ')}).`, `${name(n.id)} входит в несколько доменов (${d.join(', ')}).`)
  }
  // cross monitoring: the SMON host should itself be watched by another SMON
  for (const sm of sd.smons)
    if (sm.host && sd.smons.length > 1 && (domainOf.get(sm.host) ?? []).every((d) => d === sm.name))
      add(
        'info',
        [sm.host],
        `${sm.name}: its host ${name(sm.host)} is only watched by itself; put it in another domain for cross monitoring.`,
        `${sm.name}: host ${name(sm.host)} контролирует сам себя; для перекрёстного контроля включите его в другой домен.`,
      )

  // software
  for (const p of pcs) {
    const have = new Set(sd.software[p.id] ?? [])
    const miss = REQUIRED[roleOf(sd, p)].filter((x) => !have.has(x))
    if (miss.length) add('warning', [p.id], `${name(p.id)} (${roleOf(sd, p)}) is missing: ${miss.join(', ')}.`, `${name(p.id)} (${roleOf(sd, p)}): не хватает ${miss.join(', ')}.`)
  }
  return out
}

/** Signature of everything that a Commit freezes. */
export function sysDefSig(t: Topology, sd: SysDef) {
  const st = t.nodes
    .filter(isMonitored)
    .map((n) => `${n.id}:${n.typeId}:${n.letterbug}`)
    .sort()
  return JSON.stringify([st, sd.hosts, sd.roles, sd.smons, sd.software])
}

/** The committed configuration as a readable text report (what a SysDef commit/export would contain). */
export function commitReport(t: Topology, sd: SysDef, at: Date): string {
  const idx = nodeIndex(t)
  const lb = (id?: string) => (id && idx[id] ? (idx[id].letterbug ?? '??????') : '------')
  const pad = (s: string, n: number) => s.padEnd(n)
  const L: string[] = []
  L.push('SYSTEM DEFINITION — COMMIT REPORT')
  L.push(`Committed: ${at.toISOString().replace('T', ' ').slice(0, 19)}`)
  L.push('')
  L.push('STATIONS')
  L.push(`${pad('LETTERBUG', 10)}${pad('TYPE', 16)}${pad('ROLE', 6)}${pad('HOST', 8)}SMON`)
  const smonOf = (id: string) => sd.smons.find((s) => s.members.includes(id))?.name ?? '------'
  const order = ['server', 'workstation', 'switch', 'controller', 'fcm']
  for (const n of t.nodes.filter(isMonitored).sort((a, b) => order.indexOf(familyOf(a)) - order.indexOf(familyOf(b)) || lb(a.id).localeCompare(lb(b.id))))
    L.push(`${pad(lb(n.id), 10)}${pad(typeOf(n).label.slice(0, 15), 16)}${pad(isPc(n) ? roleOf(sd, n) : '', 6)}${pad(isController(n) ? lb(sd.hosts[n.id]) : '', 8)}${smonOf(n.id)}`)
  L.push('')
  L.push('CONTROLLER HOSTS (checkpoint file, boot image)')
  const byHost = new Map<string, string[]>()
  for (const cp of t.nodes.filter(isController)) byHost.set(sd.hosts[cp.id] ?? '', [...(byHost.get(sd.hosts[cp.id] ?? '') ?? []), lb(cp.id)])
  for (const [h, list] of byHost) L.push(`${pad(lb(h), 10)}hosts ${list.sort().join(', ')}`)
  L.push('')
  L.push('SYSTEM MONITOR DOMAINS')
  for (const sm of sd.smons) {
    L.push(`${sm.name}  host ${lb(sm.host)}  stations ${sm.members.length}`)
    L.push(
      `  monitors: ${sm.members
        .map((m) => lb(m))
        .sort()
        .join(', ')}`,
    )
    L.push(`  notifies: ${sm.notify.map((m) => lb(m)).join(', ') || '-'}`)
  }
  L.push('')
  L.push('SOFTWARE')
  for (const p of t.nodes.filter(isPc)) L.push(`${pad(lb(p.id), 10)}${(sd.software[p.id] ?? []).join(', ')}`)
  L.push('')
  L.push('Next steps: install the committed configuration on every workstation (Day 0),')
  L.push('boot the controllers from their hosts, then deploy the control database (Engineering).')
  return L.join('\n')
}

/** Fill in what a fresh SysDef would propose: roles, software per role, hosts and one SMON per EWS. */
export function autoSysDef(t: Topology, prev: SysDef = emptySysDef()): SysDef {
  const sd: SysDef = structuredClone(prev)
  const pcs = t.nodes.filter(isPc)
  for (const p of pcs) {
    sd.roles[p.id] ??= guessRole(p)
    if (!sd.software[p.id]) sd.software[p.id] = [...REQUIRED[sd.roles[p.id]], 'BACKUP']
  }
  const ews = pcs.filter((p) => sd.roles[p.id] === 'EWS')
  const hostsPool = ews.length ? ews : pcs
  for (const cp of t.nodes.filter(isController)) {
    if (sd.hosts[cp.id] || !hostsPool.length) continue
    // nearest host by network hops
    let best = hostsPool[0]
    let bestLen = Infinity
    for (const h of hostsPool) {
      const p = ethernetPath(t, new Set(), cp.id, h.id)
      if (p && p.length < bestLen) ((best = h), (bestLen = p.length))
    }
    sd.hosts[cp.id] = best.id
  }
  if (!sd.smons.length && hostsPool.length) {
    const host = hostsPool[0]
    sd.smons.push({
      id: 'sm1',
      name: 'SMON01',
      host: host.id,
      members: t.nodes.filter(isMonitored).map((n) => n.id),
      notify: pcs
        .filter((p) => sd.roles[p.id] === 'OWS' || sd.roles[p.id] === 'EWS')
        .slice(0, SMON_MAX_NOTIFY)
        .map((p) => p.id),
    })
  }
  return sd
}

/** Remove references to nodes that no longer exist. */
export function pruneSysDef(t: Topology, sd: SysDef): SysDef {
  const ids = new Set(t.nodes.map((n) => n.id))
  return {
    ...sd,
    hosts: Object.fromEntries(Object.entries(sd.hosts).filter(([k, v]) => ids.has(k) && ids.has(v))),
    roles: Object.fromEntries(Object.entries(sd.roles).filter(([k]) => ids.has(k))),
    software: Object.fromEntries(Object.entries(sd.software).filter(([k]) => ids.has(k))),
    smons: sd.smons.map((s) => ({ ...s, host: s.host && ids.has(s.host) ? s.host : undefined, members: s.members.filter((m) => ids.has(m)), notify: s.notify.filter((m) => ids.has(m)) })),
  }
}
