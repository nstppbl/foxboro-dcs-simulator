/**
 * Control Processor execution model (skeleton for Stage 2).
 *
 * A CP executes on a Basic Processing Cycle (BPC). Each compound and block has
 * a PERIOD index (see manual 2001V8 page 4-18) and a PHASE that offsets
 * execution to spread CPU load.
 */

/** PERIOD index → seconds (manual 2001V8, Table 2 "Block Rules", p. 4-18). */
export const PERIOD_SECONDS: Record<number, number> = {
  0: 0.1,
  1: 0.5, // default
  2: 1,
  3: 2,
  4: 10,
  5: 30,
  6: 60,
  7: 600,
  8: 3600,
  9: 0.2,
  10: 5,
  11: 0.6,
  12: 6,
  13: 0.05,
}

export const BASE_TICK_S = 0.05

export interface Schedulable {
  period: number
  phase: number
}

/** True if an item with this PERIOD/PHASE executes on the given BPC tick count. */
export function executesOn(item: Schedulable, tick: number): boolean {
  const every = Math.max(1, Math.round(PERIOD_SECONDS[item.period] / BASE_TICK_S))
  return tick % every === item.phase % every
}

/** Simple real-time clock that drives the CP scan and the process model. */
export class SimClock {
  private handle: number | undefined
  tick = 0
  speed = 1
  private listeners = new Set<(tick: number, dt: number) => void>()

  onTick(fn: (tick: number, dt: number) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  start() {
    if (this.handle !== undefined) return
    this.handle = window.setInterval(() => {
      this.tick++
      for (const fn of this.listeners) fn(this.tick, BASE_TICK_S * this.speed)
    }, BASE_TICK_S * 1000)
  }

  stop() {
    if (this.handle !== undefined) window.clearInterval(this.handle)
    this.handle = undefined
  }

  get running() {
    return this.handle !== undefined
  }
}
