import type { View } from '../store/nav'

/** Text: a plain string is Russian-only (English pending); otherwise bilingual. */
export type Tx = string | { en: string; ru: string }

export type QKind = 'single' | 'multi' | 'tf' | 'num'

export interface Question {
  id: string
  kind: QKind
  q: Tx
  /** code shown under the question (HLBL, configuration excerpt) */
  code?: string
  /** options for single / multi */
  options?: Tx[]
  /** single: index; multi: indexes; tf: boolean; num: value */
  answer: number | number[] | boolean
  /** num: allowed absolute error */
  tol?: number
  explain: Tx
  /** source, e.g. "2001V8 4-19" */
  src?: string
}

export interface InterviewQ {
  id: string
  q: Tx
  /** key points an expert answer must contain; kw = words that show the point is covered */
  points: { t: Tx; kw: string[] }[]
  model: Tx
}

export interface Practice {
  label: Tx
  view: View
  /** load an architecture exercise */
  exercise?: string
  /** load an architecture preset */
  preset?: string
  /** load a process scenario */
  scenario?: string
}

export interface Lesson {
  id: string
  title: Tx
  minutes: number
  /** markdown sections */
  base: Tx
  classic?: Tx
  modern?: Tx
  field?: Tx
  practice?: Practice[]
  quiz: Question[]
  interview?: InterviewQ[]
}

export interface Module {
  id: string
  n: number
  title: Tx
  goal: Tx
  lessons: Lesson[]
}

export interface GlossaryEntry {
  term: string
  /** classic name (I/A Series), if it changed */
  old?: string
  /** modern name (EcoStruxure Foxboro DCS) */
  now?: string
  def: Tx
  module?: string
}
