/**
 * Core types of the simulated Control Processor (CP) database.
 *
 * Terminology follows I/A Series: a CP holds Compounds; a Compound holds
 * Blocks; a Block has Parameters. Connections use the C:B.P syntax
 * (Compound:Block.Parameter), or :B.P for a block in the same compound.
 */

import type { AlarmCond } from './alarms'

export type Val = number | boolean | string

/** Parameter data type: Real, Integer, Boolean, String */
export type PType = 'R' | 'I' | 'B' | 'S'

/** in = input (connectable), out = output, cfg = configuration only */
export type PKind = 'in' | 'out' | 'cfg'

export interface ParamDef {
  name: string
  type: PType
  def: Val
  kind: PKind
  /** can be changed on-line from displays (if not linked) */
  settable?: boolean
  /** can take a C:B.P connection */
  conn?: boolean
  /** short description (English, Foxboro wording) */
  desc: string
  /** manual page reference */
  src?: string
  /** UI grouping */
  group?: 'general' | 'io' | 'control' | 'tune' | 'alarm' | 'status'
}

export interface Block {
  /** block name, ≤12 chars, unique within its compound */
  name: string
  type: string
  compound: string
  /** current parameter values */
  p: Record<string, Val>
  /** parameter → source "C:B.P" or ":B.P" */
  links: Record<string, string>
  /** private runtime state of the algorithm */
  st: Record<string, unknown>
  /** quality of each output: true = BAD */
  bad: Record<string, boolean>
}

export interface Compound {
  name: string
  p: Record<string, Val>
  /** block names in execution order */
  blocks: string[]
}

export interface StationDb {
  letterbug: string
  /** compound names in execution order */
  compounds: string[]
  cmp: Record<string, Compound>
  /** key = "COMPOUND:BLOCK" */
  blk: Record<string, Block>
}

export interface ExecCtx {
  /** seconds since the last execution of this block */
  dt: number
  /** simulation time, seconds */
  time: number
  /** read a connected (or local) input with its quality */
  input: (b: Block, param: string) => { v: Val; bad: boolean; linked: boolean }
  num: (b: Block, param: string) => number
  /** write a parameter of another block (used by HLBL, MTR feedback etc.) */
  write: (ref: string, v: Val, from: Block) => boolean
  read: (ref: string, from: Block) => { v: Val; bad: boolean } | undefined
  message: (b: Block, text: string) => void
  /** report the block's alarm conditions for this scan */
  alarm: (b: Block, conds: AlarmCond[]) => void
  /** field I/O (simulated FBM channels) */
  field: {
    read: (iomId: string, pnt: number) => { v: number; bad: boolean } | undefined
    write: (iomId: string, pnt: number, v: number) => void
  }
}

export interface BlockTypeDef {
  type: string
  family: 'io' | 'control' | 'calc' | 'logic' | 'sequence' | 'process'
  desc: { en: string; ru: string }
  params: ParamDef[]
  init?: (b: Block) => void
  exec: (b: Block, ctx: ExecCtx) => void
  /** which alarm types the block can raise */
  alarms?: string[]
}

export const key = (compound: string, block: string) => `${compound}:${block}`
