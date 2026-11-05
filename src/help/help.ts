import { create } from 'zustand'
import { CATALOG_BY_ID } from '../domain/hardware/catalog'
import { BLOCK_TYPES } from '../engine/registry'
import { BLOCK_HELP, PARAM_RU, SCREEN_HELP, type HelpDoc } from './content'

/**
 * Help topics are addressed by keys:
 *   block:PID · param:PID.PBAND · screen:cad · hw:FCP280
 * Any element with a data-help="<key>" attribute can be clicked in help mode.
 */
interface HelpState {
  topic?: string
  /** "click to learn" mode: the next click on a data-help element opens its topic */
  mode: boolean
  /** drawer shows the index (Reference) */
  index: boolean
  open: (topic: string) => void
  openIndex: () => void
  close: () => void
  setMode: (m: boolean) => void
}

export const useHelp = create<HelpState>()((set) => ({
  mode: false,
  index: false,
  open: (topic) => set({ topic, index: false, mode: false }),
  openIndex: () => set({ index: true, topic: undefined }),
  close: () => set({ topic: undefined, index: false }),
  setMode: (mode) => set({ mode }),
}))

export interface ParamHelp {
  name: string
  en: string
  ru?: string
  src?: string
  /** block types that have this parameter */
  types: string[]
  kind?: string
  def?: unknown
  conn?: boolean
  settable?: boolean
}

export function paramHelp(name: string, type?: string): ParamHelp | undefined {
  const types = Object.keys(BLOCK_TYPES).filter((t) => BLOCK_TYPES[t].params.some((p) => p.name === name))
  const owner = type && types.includes(type) ? type : types[0]
  const d = owner ? BLOCK_TYPES[owner].params.find((p) => p.name === name) : undefined
  if (!d && !PARAM_RU[name]) return undefined
  return { name, en: d?.desc ?? '', ru: PARAM_RU[name], src: d?.src, types, kind: d?.kind, def: d?.def, conn: d?.conn, settable: d?.settable }
}

export type Resolved = { kind: 'doc'; doc: HelpDoc; block?: string } | { kind: 'param'; p: ParamHelp; block?: string } | { kind: 'hw'; id: string } | { kind: 'none'; topic: string }

export function resolve(topic: string): Resolved {
  const [k, rest = ''] = topic.split(/:(.*)/s)
  if (k === 'block') {
    const doc = BLOCK_HELP[rest]
    if (doc) return { kind: 'doc', doc, block: rest }
    const t = BLOCK_TYPES[rest]
    if (t) return { kind: 'doc', doc: { title: { en: rest, ru: rest }, what: t.desc }, block: rest }
  }
  if (k === 'param') {
    const [type, name] = rest.includes('.') ? rest.split('.') : [undefined, rest]
    const p = paramHelp(name, type)
    if (p) return { kind: 'param', p, block: type }
  }
  if (k === 'screen' && SCREEN_HELP[rest]) return { kind: 'doc', doc: SCREEN_HELP[rest] }
  if (k === 'hw' && CATALOG_BY_ID[rest]) return { kind: 'hw', id: rest }
  return { kind: 'none', topic }
}

/** Props for an element that has help: spread {...help('block:PID')} */
export const help = (topic: string) => ({ 'data-help': topic })
