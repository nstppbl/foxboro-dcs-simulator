/** Short builders for quiz questions, used by the 2300v8 and HLBL courses. */
import type { InterviewQ, Question, Tx } from './types'

const SRC_DEFAULT = undefined as string | undefined

export const one = (id: string, q: Tx, options: Tx[], answer: number, explain: Tx, src = SRC_DEFAULT, code?: string): Question => ({ id, kind: 'single', q, options, answer, explain, src, code })
export const many = (id: string, q: Tx, options: Tx[], answer: number[], explain: Tx, src = SRC_DEFAULT, code?: string): Question => ({ id, kind: 'multi', q, options, answer, explain, src, code })
export const tf = (id: string, q: Tx, answer: boolean, explain: Tx, src = SRC_DEFAULT, code?: string): Question => ({ id, kind: 'tf', q, answer, explain, src, code })
export const num = (id: string, q: Tx, answer: number, explain: Tx, src = SRC_DEFAULT, tol?: number): Question => ({ id, kind: 'num', q, answer, explain, src, tol })
/** interview question: points are [text, keywords…] */
export const iq = (id: string, q: Tx, points: [string, ...string[]][], model: Tx): InterviewQ => ({ id, q, points: points.map(([t, ...kw]) => ({ t, kw })), model })
