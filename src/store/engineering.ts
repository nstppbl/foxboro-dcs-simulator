import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  blockState,
  cloneCfg,
  compoundState,
  freeName,
  fromStationDb,
  NAME_RE,
  renameBlock,
  toStationDb,
  validateCfg,
  type CfgDb,
  type CfgIssue,
} from '../engine/config'
import { lab1Cfg, scenario, SCENARIOS } from '../engine/scenarios'
import { paramDef } from '../engine/registry'
import { parseRef } from '../engine/station'
import type { Val } from '../engine/types'
import { useSim } from './sim'

export { lab1Cfg, labCfg } from '../engine/scenarios'

export type EditorKind = 'csd' | 'icc'

interface EngState {
  cfg: CfgDb
  /** what is in the CP (last download) */
  cp: CfgDb
  editor: EditorKind
  selC: string
  selB?: string
  issues?: CfgIssue[]
  log: string[]
  lab?: 'lab1'
  scenario: string
  setEditor: (e: EditorKind) => void
  selectCompound: (c: string) => void
  selectBlock: (b?: string) => void
  addBlock: (type: string, x?: number, y?: number) => void
  deleteBlock: (c: string, b: string) => void
  moveBlock: (c: string, b: string, x: number, y: number) => void
  moveOrder: (c: string, b: string, dir: -1 | 1) => void
  rename: (c: string, from: string, to: string) => boolean
  setValue: (c: string, b: string, param: string, raw: string | Val) => boolean
  setLink: (c: string, b: string, param: string, src: string) => boolean
  addCompound: (name: string) => boolean
  deleteCompound: (c: string) => void
  setCompound: (c: string, param: string, v: Val) => void
  validate: () => CfgIssue[]
  download: () => boolean
  upload: () => void
  resetLab: (which?: 'full' | 'lab1') => void
  loadScenario: (id: string) => void
}

const toast = (text: string, err = false) => useSim.getState().notify(text, err)

function coerce(type: string, raw: string | Val): Val | undefined {
  if (type === 'S') return String(raw)
  if (type === 'B') return typeof raw === 'boolean' ? raw : ['1', 'TRUE', 'ON', 'YES'].includes(String(raw).trim().toUpperCase())
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'))
  if (!Number.isFinite(n)) return undefined
  return type === 'I' ? Math.round(n) : n
}

export const useEng = create<EngState>()(
  persist(
    (set, get) => {
      const mutate = (fn: (cfg: CfgDb) => void) => {
        const cfg = cloneCfg(get().cfg)
        fn(cfg)
        set({ cfg, issues: undefined })
      }
      const cmp = (cfg: CfgDb, c: string) => cfg.compounds.find((x) => x.name === c)
      const blk = (cfg: CfgDb, c: string, b: string) => cmp(cfg, c)?.blocks.find((x) => x.name === b)
      const lab = SCENARIOS[0].cfg()
      return {
        scenario: 'tank2',
        cfg: lab,
        cp: cloneCfg(lab),
        editor: 'csd',
        selC: 'TANK2_COMP',
        selB: 'LC100',
        log: [],
        setEditor: (editor) => set({ editor }),
        selectCompound: (selC) => set({ selC, selB: undefined }),
        selectBlock: (selB) => set({ selB }),
        addBlock: (type, x, y) => {
          const c = cmp(get().cfg, get().selC)
          if (!c) return toast('Select a compound first', true)
          const name = freeName(c, type)
          mutate((cfg) => {
            const cc = cmp(cfg, get().selC)!
            const n = cc.blocks.length
            cc.blocks.push({ name, type, v: {}, links: {}, x: x ?? 40 + (n % 4) * 290, y: y ?? 60 + Math.floor(n / 4) * 220 })
          })
          set({ selB: name })
        },
        deleteBlock: (c, b) => {
          mutate((cfg) => {
            const cc = cmp(cfg, c)
            if (cc) cc.blocks = cc.blocks.filter((x) => x.name !== b)
          })
          if (get().selB === b) set({ selB: undefined })
        },
        moveBlock: (c, b, x, y) => {
          // position only: no need to clear validation
          const cfg = cloneCfg(get().cfg)
          const bb = blk(cfg, c, b)
          if (!bb) return
          bb.x = Math.max(0, Math.round(x / 10) * 10)
          bb.y = Math.max(0, Math.round(y / 10) * 10)
          set({ cfg })
        },
        moveOrder: (c, b, dir) =>
          mutate((cfg) => {
            const cc = cmp(cfg, c)
            if (!cc) return
            const i = cc.blocks.findIndex((x) => x.name === b)
            const j = i + dir
            if (i < 0 || j < 0 || j >= cc.blocks.length) return
            ;[cc.blocks[i], cc.blocks[j]] = [cc.blocks[j], cc.blocks[i]]
          }),
        rename: (c, from, to) => {
          to = to.trim().toUpperCase()
          if (to === from) return true
          if (!NAME_RE.test(to)) {
            toast(`${to}: block name must be 1-12 characters A-Z, 0-9, _`, true)
            return false
          }
          if (blk(get().cfg, c, to)) {
            toast(`${c}:${to} already exists`, true)
            return false
          }
          mutate((cfg) => renameBlock(cfg, c, from, to))
          if (get().selB === from) set({ selB: to })
          return true
        },
        setValue: (c, b, param, raw) => {
          const bb = blk(get().cfg, c, b)
          if (!bb) return false
          const d = paramDef(bb.type, param)
          if (!d) return false
          // ICC style: typing a C:B.P string into a connectable parameter makes a connection
          if (typeof raw === 'string' && d.conn && /:[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/.test(raw.trim()) && d.type !== 'S') return get().setLink(c, b, param, raw)
          const v = coerce(d.type, raw)
          if (v === undefined) {
            toast(`${b}.${param}: a number is expected`, true)
            return false
          }
          mutate((cfg) => {
            const x = blk(cfg, c, b)!
            delete x.links[param]
            if (v === d.def) delete x.v[param]
            else x.v[param] = v
          })
          return true
        },
        setLink: (c, b, param, src) => {
          const bb = blk(get().cfg, c, b)
          if (!bb) return false
          const d = paramDef(bb.type, param)
          src = src.trim().toUpperCase()
          if (src && !d?.conn) {
            toast(`${b}.${param} is not connectable`, true)
            return false
          }
          if (src && !parseRef(src, c)) {
            toast(`"${src}": use COMPOUND:BLOCK.PARAM or :BLOCK.PARAM`, true)
            return false
          }
          mutate((cfg) => {
            const x = blk(cfg, c, b)!
            if (src) {
              x.links[param] = src
              delete x.v[param]
            } else delete x.links[param]
          })
          return true
        },
        addCompound: (name) => {
          name = name.trim().toUpperCase()
          if (!NAME_RE.test(name)) {
            toast(`${name}: compound name must be 1-12 characters A-Z, 0-9, _`, true)
            return false
          }
          if (cmp(get().cfg, name)) {
            toast(`${name} already exists`, true)
            return false
          }
          mutate((cfg) => cfg.compounds.push({ name, p: { DESCRP: '', PERIOD: 1, PHASE: 0, CINHIB: 0, ON: true }, blocks: [] }))
          set({ selC: name, selB: undefined })
          return true
        },
        deleteCompound: (c) => {
          mutate((cfg) => (cfg.compounds = cfg.compounds.filter((x) => x.name !== c)))
          set({ selC: get().cfg.compounds[0]?.name ?? '', selB: undefined })
        },
        setCompound: (c, param, v) =>
          mutate((cfg) => {
            const cc = cmp(cfg, c)
            if (cc) cc.p[param] = v
          }),
        validate: () => {
          const issues = validateCfg(get().cfg)
          const e = issues.filter((i) => i.sev === 'error').length
          const w = issues.filter((i) => i.sev === 'warning').length
          set({ issues, log: [...get().log, `Validate ${get().cfg.letterbug}: ${e} error(s), ${w} warning(s)`] })
          return issues
        },
        download: () => {
          const issues = get().validate()
          const errs = issues.filter((i) => i.sev === 'error')
          const { cfg, cp } = get()
          if (errs.length) {
            set({ log: [...get().log, `Download to ${cfg.letterbug} REFUSED: fix ${errs.length} validation error(s) first`] })
            toast(`Download refused: ${errs.length} validation error(s)`, true)
            return false
          }
          const changed = new Set<string>()
          const lines: string[] = []
          for (const c of cfg.compounds) {
            const cs = compoundState(c, cp)
            if (cs !== 'Downloaded') {
              changed.add(c.name)
              lines.push(`  ${c.name}: ${cs === 'Added' ? 'created' : 'updated'}`)
            }
            for (const b of c.blocks) {
              const s = blockState(c, b, cp)
              if (s !== 'Downloaded') {
                changed.add(`${c.name}:${b.name}`)
                lines.push(`    ${c.name}:${b.name} (${b.type}) ${s === 'Added' ? 'added' : 'modified'}`)
              }
            }
          }
          for (const c of cp.compounds) {
            const nc = cmp(cfg, c.name)
            if (!nc) lines.push(`  ${c.name}: deleted from CP`)
            else for (const b of c.blocks) if (!nc.blocks.some((x) => x.name === b.name)) lines.push(`    ${c.name}:${b.name} deleted from CP`)
          }
          useSim.getState().load(toStationDb(cfg), 'download', changed)
          set({ cp: cloneCfg(cfg), log: [...get().log, `Download to ${cfg.letterbug}: ${lines.length ? '' : 'nothing changed'}`, ...lines, '  Download complete.'] })
          toast(`Downloaded to ${cfg.letterbug}`)
          return true
        },
        upload: () => {
          const db = useSim.getState().station.db
          const cfg = fromStationDb(db, get().cfg)
          set({ cfg, cp: cloneCfg(cfg), issues: undefined, log: [...get().log, `Upload from ${db.letterbug}: current CP values copied into the configuration`] })
        },
        resetLab: (which = 'full') => {
          if (which === 'lab1') {
            const cfg = lab1Cfg()
            useSim.getState().load(toStationDb(cfg), 'warm')
            set({ scenario: 'tank2', cfg, cp: cloneCfg(cfg), issues: undefined, selC: 'TANK2_COMP', selB: undefined, lab: 'lab1', log: [`Loaded LAB 1 exercise (empty TANK2_COMP) into ${cfg.letterbug}`] })
          } else get().loadScenario(get().scenario)
        },
        loadScenario: (id) => {
          const sc = scenario(id)
          const cfg = sc.cfg()
          useSim.getState().load(toStationDb(cfg), 'warm', undefined, sc.plant?.())
          useSim.getState().select({ kind: 'compound', c: cfg.compounds[0].name })
          set({ scenario: sc.id, cfg, cp: cloneCfg(cfg), issues: undefined, selC: cfg.compounds[0].name, selB: undefined, lab: undefined, log: [`Loaded scenario "${sc.title.en}" into ${cfg.letterbug}`] })
        },
      }
    },
    { name: 'fox.eng.v1', partialize: (s) => ({ cfg: s.cfg, cp: s.cp, editor: s.editor, selC: s.selC, lab: s.lab, scenario: s.scenario }) },
  ),
)

// If the CP held a different configuration last time, start the simulated CP from it.
{
  const { cp, scenario: sid } = useEng.getState()
  if (sid !== 'tank2' || JSON.stringify(cp) !== JSON.stringify(SCENARIOS[0].cfg())) {
    try {
      useSim.getState().load(toStationDb(cp), 'warm', undefined, scenario(sid).plant?.())
    } catch {
      useEng.getState().resetLab()
    }
  }
}
