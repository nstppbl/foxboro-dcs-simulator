/**
 * Process alarm handling: block alarm detection results feed this manager,
 * which keeps the Current Alarms Display (CAD) list and the alarm history,
 * honouring block INHIB and compound CINHIB (manual 2001V8 p. 4-39…4-52, ch. 11).
 */

export type AlarmType =
  | 'HIABS'
  | 'LOABS'
  | 'HHABS'
  | 'LLABS'
  | 'HIDEV'
  | 'LODEV'
  | 'HIOUT'
  | 'LOOUT'
  | 'BAD'
  | 'OOR'
  | 'STATE'

/** PRTYPE codes (alarm type of the highest-priority active alarm). */
export const PRTYPE: Record<AlarmType, number> = {
  HIABS: 1,
  LOABS: 2,
  HHABS: 3,
  LLABS: 4,
  HIDEV: 5,
  LODEV: 6,
  HIOUT: 7,
  LOOUT: 7,
  BAD: 8,
  OOR: 8,
  STATE: 9,
}

export interface AlarmCond {
  type: AlarmType
  active: boolean
  /** priority 1 (highest) … 5 (lowest) */
  pri: number
  text: string
  value?: number
  limit?: number
  eu?: string
}

export interface AlarmEntry {
  id: number
  /** "COMPOUND:BLOCK" */
  ref: string
  compound: string
  block: string
  /** MEASNM / OUTNM style alarm name */
  name: string
  descrp: string
  type: AlarmType
  pri: number
  text: string
  value?: number
  limit?: number
  eu?: string
  active: boolean
  acked: boolean
  /** inhibited (INHIB / CINHIB): tracked but not announced */
  inhibited: boolean
  t: number
  /** time it returned to normal */
  tRtn?: number
}

export interface HistoryEntry {
  t: number
  ref: string
  type: AlarmType | 'ACK' | 'RTN' | 'MSG'
  pri: number
  text: string
  value?: number
}

/** True if a priority is inhibited by the compound CINHIB setting. */
export function cinhibBlocks(cinhib: number, pri: number): boolean {
  if (!cinhib) return false
  if (cinhib === 1) return true
  return pri >= cinhib
}

export class AlarmManager {
  private seq = 0
  /** current alarm entries (active, or returned-but-unacked) */
  entries: AlarmEntry[] = []
  history: HistoryEntry[] = []
  maxCad = 200
  maxHistory = 2000

  private find(ref: string, type: AlarmType) {
    return this.entries.find((e) => e.ref === ref && e.type === type)
  }

  update(
    t: number,
    meta: { ref: string; compound: string; block: string; name: string; descrp: string; inhibited: boolean },
    c: AlarmCond,
  ) {
    const e = this.find(meta.ref, c.type)
    if (c.active) {
      if (!e || !e.active) {
        // new alarm (or re-alarm after return)
        if (e) this.entries = this.entries.filter((x) => x !== e)
        const entry: AlarmEntry = {
          id: ++this.seq,
          ...meta,
          type: c.type,
          pri: c.pri,
          text: c.text,
          value: c.value,
          limit: c.limit,
          eu: c.eu,
          active: true,
          acked: meta.inhibited, // inhibited alarms are not announced
          inhibited: meta.inhibited,
          t,
        }
        this.entries.push(entry)
        if (!meta.inhibited) this.log({ t, ref: meta.ref, type: c.type, pri: c.pri, text: c.text, value: c.value })
        if (this.entries.length > this.maxCad) this.entries.shift()
      } else {
        e.value = c.value
        if (e.pri !== c.pri) {
          // re-alarm on priority change
          e.pri = c.pri
          e.acked = meta.inhibited
        }
        e.inhibited = meta.inhibited
      }
    } else if (e && e.active) {
      e.active = false
      e.tRtn = t
      e.value = c.value
      if (!e.inhibited) this.log({ t, ref: meta.ref, type: 'RTN', pri: e.pri, text: `${c.type} returned to normal`, value: c.value })
      if (e.acked) this.entries = this.entries.filter((x) => x !== e)
    }
  }

  ack(t: number, ref: string) {
    let n = 0
    for (const e of this.entries)
      if (e.ref === ref && !e.acked) {
        e.acked = true
        n++
      }
    this.entries = this.entries.filter((e) => e.active || !e.acked)
    if (n) this.log({ t, ref, type: 'ACK', pri: 0, text: 'Acknowledged' })
    return n
  }

  ackCompound(t: number, compound: string) {
    const refs = new Set(this.entries.filter((e) => e.compound === compound).map((e) => e.ref))
    refs.forEach((r) => this.ack(t, r))
  }

  message(t: number, ref: string, text: string) {
    this.log({ t, ref, type: 'MSG', pri: 0, text })
  }

  blockUnacked(ref: string) {
    return this.entries.some((e) => e.ref === ref && !e.acked)
  }

  /** CAD ordering: active unacked → active acked → returned unacked; then priority, then newest first */
  cad(): AlarmEntry[] {
    const grp = (e: AlarmEntry) => (e.active && !e.acked ? 0 : e.active ? 1 : 2)
    return this.entries
      .filter((e) => !e.inhibited)
      .slice()
      .sort((a, b) => grp(a) - grp(b) || a.pri - b.pri || b.t - a.t)
  }

  private log(h: HistoryEntry) {
    this.history.push(h)
    if (this.history.length > this.maxHistory) this.history.shift()
  }
}
