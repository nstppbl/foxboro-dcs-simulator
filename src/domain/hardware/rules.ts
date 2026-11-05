import type { Bilingual } from './catalog'
import {
  familyOf,
  fbmController,
  fbmHost,
  isStation,
  linksOf,
  neighbors,
  nodeName,
  typeOf,
  type HwNode,
  type Topology,
} from './model'
import { analyzeNetwork, ethernetPath } from './network'

export type Severity = 'error' | 'warning' | 'info'

export interface Issue {
  severity: Severity
  nodeIds: string[]
  msg: Bilingual
  /** manual reference */
  src?: string
}

const LB_RE = /^[A-Z0-9]{6}$/

/**
 * Configuration rules for the hardware topology. Each rule mirrors a constraint
 * from the 2001V8 course (chapter 2) so trainees learn *why* a design is wrong.
 */
export function validateTopology(t: Topology, failed: Set<string> = new Set()): Issue[] {
  const out: Issue[] = []
  const add = (severity: Severity, nodes: HwNode[], en: string, ru: string, src?: string) =>
    out.push({ severity, nodeIds: nodes.map((n) => n.id), msg: { en, ru }, src })

  // --- Letterbugs -------------------------------------------------------------
  const lbOwners = new Map<string, HwNode[]>()
  for (const n of t.nodes) {
    const f = familyOf(n)
    if (!(isStation(n) || f === 'fbm')) continue
    const lb = (n.letterbug ?? '').toUpperCase()
    if (!lb) {
      add('error', [n], `${typeOf(n).label} has no letterbug.`, `У ${typeOf(n).label} нет letterbug.`, '2-92')
      continue
    }
    if (!LB_RE.test(lb))
      add('error', [n], `Letterbug "${lb}" must be exactly 6 characters A-Z / 0-9.`, `Letterbug "${lb}" должен состоять ровно из 6 символов A-Z / 0-9.`, '2-73')
    lbOwners.set(lb, [...(lbOwners.get(lb) ?? []), n])
  }
  for (const [lb, owners] of lbOwners)
    if (owners.length > 1) add('error', owners, `Duplicate letterbug "${lb}". Letterbugs must be unique in the system.`, `Повторяющийся letterbug "${lb}". Letterbug должен быть уникален в системе.`)

  // --- FBMs ------------------------------------------------------------------
  for (const fbm of t.nodes.filter((n) => familyOf(n) === 'fbm')) {
    const host = fbmHost(t, fbm.id)
    if (!host) {
      add('error', [fbm], `${nodeName(fbm)} is not on any module fieldbus (connect it to an FCP or FCM100Et).`, `${nodeName(fbm)} не подключён к fieldbus (подключите к FCP или FCM100Et).`, '2-73')
      continue
    }
    const lb = (fbm.letterbug ?? '').toUpperCase()
    const hlb = (host.letterbug ?? '').toUpperCase()
    if (lb && hlb && lb.slice(0, 4) !== hlb.slice(0, 4))
      add('error', [fbm, host], `FBM letterbug ${lb}: the first four characters are set by its host (${hlb.slice(0, 4)}); 5th = baseplate, 6th = position.`, `Letterbug FBM ${lb}: первые четыре символа задаёт хост (${hlb.slice(0, 4)}); 5-й = базовая плата, 6-й = позиция.`, '2-73')
    if (!neighbors(t, fbm.id, 'tacable').length)
      add('warning', [fbm], `${nodeName(fbm)} has no Termination Assembly, so no field devices can be wired.`, `У ${nodeName(fbm)} нет клеммной сборки — нельзя подключить приборы.`, '2-95')
    if (!fbmController(t, fbm.id))
      add('error', [fbm], `${nodeName(fbm)}: its FCM100Et is not hosted by a ZCP270.`, `${nodeName(fbm)}: его FCM100Et не привязан к ZCP270.`, '2-45')
  }

  // --- Controllers / FCMs capacity -----------------------------------------
  for (const cp of t.nodes.filter((n) => familyOf(n) === 'controller')) {
    const ct = typeOf(cp)
    if (cp.typeId === 'ZCP270') {
      const fcms = neighbors(t, cp.id, 'host')
      const fbms = fcms.flatMap((f) => neighbors(t, f.id, 'fieldbus'))
      if (fbms.length > (ct.maxFbmsTotal ?? 128))
        add('error', [cp], `ZCP270 has ${fbms.length} FBMs; maximum is 128.`, `У ZCP270 ${fbms.length} FBM; максимум 128.`, '2-73')
      if (!fcms.length) add('info', [cp], 'ZCP270 has no FCM100Et, so it has no I/O.', 'У ZCP270 нет FCM100Et — нет ввода-вывода.', '2-45')
    } else if (ct.maxFbms !== undefined) {
      const n = neighbors(t, cp.id, 'fieldbus').length
      if (n > ct.maxFbms) add('error', [cp], `${ct.label} has ${n} FBMs; maximum is ${ct.maxFbms}.`, `У ${ct.label} ${n} FBM; максимум ${ct.maxFbms}.`, '2-46')
    }
  }
  for (const fcm of t.nodes.filter((n) => familyOf(n) === 'fcm')) {
    if (!neighbors(t, fcm.id, 'host').length)
      add('error', [fcm], `${nodeName(fcm)} is not assigned to a ZCP270.`, `${nodeName(fcm)} не привязан к ZCP270.`, '2-71')
  }

  // --- TAs / instruments ----------------------------------------------------
  for (const ta of t.nodes.filter((n) => familyOf(n) === 'ta'))
    if (!neighbors(t, ta.id, 'tacable').length) add('warning', [ta], 'Termination Assembly is not cabled to an FBM.', 'Клеммная сборка не подключена к FBM.', '2-95')
  for (const inst of t.nodes.filter((n) => familyOf(n) === 'instrument')) {
    if (!linksOf(t, inst.id, 'field').length) add('warning', [inst], `${nodeName(inst)} is not wired to a Termination Assembly.`, `${nodeName(inst)} не подключён к клеммной сборке.`)
    if (!inst.tag) add('warning', [inst], 'Instrument has no tag name.', 'У прибора нет тега.')
  }

  // --- MESH -----------------------------------------------------------------
  const stations = t.nodes.filter(isStation)
  for (const s of stations)
    if (!linksOf(t, s.id, 'mesh').length) add('error', [s], `${nodeName(s)} is not connected to the MESH Control Network.`, `${nodeName(s)} не подключён к сети MESH.`, '2-99')

  const net = analyzeNetwork(t, failed)
  for (const s of net.nonRedundant)
    if (linksOf(t, s.id, 'mesh').length)
      add('warning', [s], `${nodeName(s)} has a single MESH connection. Stations should connect to two switches (A and B) for redundancy.`, `${nodeName(s)} подключён к MESH одним кабелем. Станции должны подключаться к двум коммутаторам (A и B).`, '2-100')

  // Sides: connected to both A and B?
  for (const s of stations) {
    const sides = new Set(neighbors(t, s.id, 'mesh').map((sw) => sw.side))
    if (sides.size === 1 && neighbors(t, s.id, 'mesh').length >= 2)
      add('warning', [s], `${nodeName(s)}: both MESH ports go to side ${[...sides][0]} switches. Port A should go to an A-side switch, port B to a B-side switch.`, `${nodeName(s)}: оба порта MESH идут на коммутаторы стороны ${[...sides][0]}. Порт A — на коммутатор A, порт B — на коммутатор B.`, '2-111')
  }

  if (net.topology === 'linear' && net.switchCount > 2)
    add('error', t.nodes.filter((n) => familyOf(n) === 'switch'), 'A linear configuration with more than two switches is not supported (no network redundancy).', 'Линейная топология с более чем двумя коммутаторами не поддерживается (нет резервирования).', '2-103')
  if (net.topology === 'disconnected')
    add('error', t.nodes.filter((n) => familyOf(n) === 'switch'), 'Switches form separate islands; link them with uplinks.', 'Коммутаторы образуют отдельные группы — соедините их аплинками.', '2-99')
  if (net.maxHops > 7)
    add('error', [], `Up to ${net.maxHops} switches between two stations; the RSTP limit is seven.`, `Между двумя станциями до ${net.maxHops} коммутаторов; лимит RSTP — семь.`, '2-104')
  for (const sp of net.spof)
    add('warning', [sp.sw], `Single point of failure: if ${nodeName(sp.sw)} fails, ${sp.isolated.map(nodeName).join(', ')} lose communication.`, `Единая точка отказа: при отказе ${nodeName(sp.sw)} теряют связь: ${sp.isolated.map(nodeName).join(', ')}.`, '2-100')

  // --- System-level ----------------------------------------------------------
  const ws = t.nodes.filter((n) => familyOf(n) === 'workstation')
  if (!ws.length) add('warning', [], 'No workstation: operators have nowhere to run FoxView / Control HMI.', 'Нет рабочей станции — оператору негде запустить FoxView / Control HMI.')
  const cps = t.nodes.filter((n) => familyOf(n) === 'controller')
  for (const cp of cps) {
    if (failed.has(cp.id)) continue
    const reach = ws.some((w) => !failed.has(w.id) && ethernetPath(t, failed, cp.id, w.id))
    if (ws.length && !reach && linksOf(t, cp.id, 'mesh').length)
      add('error', [cp], `${nodeName(cp)} cannot reach any workstation over MESH.`, `${nodeName(cp)} не видит ни одной рабочей станции по MESH.`)
  }
  const servers = t.nodes.filter((n) => familyOf(n) === 'server')
  if (cps.length && !servers.length && !ws.length)
    add('info', [], 'Controllers need a boot host (workstation/server) holding their checkpoint file (unless self-hosting).', 'Контроллерам нужен boot host с checkpoint-файлом (если не включён self-hosting).', '2-44')

  return out
}
