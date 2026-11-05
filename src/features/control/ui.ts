import { useLang } from '../../i18n/i18n'
import type { Val } from '../../engine/types'

/** FoxView faceplate / alarm colours by priority 1…5 (manual ch. 6, 11). */
export const PRI_COLOR: Record<number, string> = {
  1: '#e01010',
  2: '#d000d0',
  3: '#a0522d',
  4: '#00a8c0',
  5: '#b8b8b8',
}

export const priColor = (p: number) => PRI_COLOR[p] ?? '#888'

export function fmt(v: Val | undefined, dec = 2): string {
  if (v === undefined) return '—'
  if (typeof v === 'boolean') return v ? '1 (TRUE)' : '0 (FALSE)'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(dec)
  return v
}

export function simTime(t: number) {
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = Math.floor(t % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Inline bilingual text: Foxboro terms stay in English inside both strings. */
export function useL() {
  const { lang } = useLang()
  return (en: string, ru: string) => (lang === 'ru' ? ru : en)
}
