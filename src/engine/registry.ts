import { CALC, CHARC, SWCH } from './blocks/calc'
import { HLBL } from './blocks/hlbl'
import { AIN, AOUT, DIN, DOUT } from './blocks/io'
import { PID, PIDA, RATIO } from './blocks/pid'
import { DTIME, LLAG, MTR } from './blocks/process'
import type { Block, BlockTypeDef, ParamDef, Val } from './types'

export const BLOCK_TYPES: Record<string, BlockTypeDef> = Object.fromEntries(
  [AIN, AOUT, DIN, DOUT, PID, PIDA, RATIO, CALC, CHARC, SWCH, LLAG, DTIME, MTR, HLBL].map((d) => [d.type, d]),
)

export function paramDef(type: string, name: string): ParamDef | undefined {
  return BLOCK_TYPES[type]?.params.find((p) => p.name === name)
}

/** Create a block with default parameter values, then apply overrides and links. */
export function newBlock(
  compound: string,
  name: string,
  type: string,
  values: Record<string, Val> = {},
  links: Record<string, string> = {},
): Block {
  const def = BLOCK_TYPES[type]
  if (!def) throw new Error(`unknown block type ${type}`)
  const p: Record<string, Val> = {}
  for (const d of def.params) p[d.name] = d.def
  for (const [k, v] of Object.entries(values)) p[k] = v
  return { name, type, compound, p, links: { ...links }, st: {}, bad: {} }
}
