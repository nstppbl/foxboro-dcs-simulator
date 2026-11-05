import { describe, expect, it } from 'vitest'
import { exercise } from '../../domain/hardware/exercises'
import { SCENARIOS } from '../../engine/scenarios'
import { dueIds, srsNext } from '../../store/theory'
import { ALL_INTERVIEW, ALL_LESSONS, ALL_QUESTIONS, GLOSSARY, MODULES, coveredPoints, isRight } from '..'

describe('theory content', () => {
  it('has unique ids', () => {
    const ids = [...MODULES.map((m) => m.id), ...ALL_LESSONS.map((l) => l.id), ...ALL_QUESTIONS.map((q) => q.id), ...ALL_INTERVIEW.map((q) => q.id)]
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('every question has a valid answer', () => {
    for (const q of ALL_QUESTIONS) {
      if (q.kind === 'single') {
        expect(q.options?.length, q.id).toBeGreaterThan(1)
        expect(q.answer as number, q.id).toBeLessThan(q.options!.length)
      }
      if (q.kind === 'multi') for (const a of q.answer as number[]) expect(a, q.id).toBeLessThan(q.options!.length)
      if (q.kind === 'tf') expect(typeof q.answer, q.id).toBe('boolean')
      if (q.kind === 'num') expect(typeof q.answer, q.id).toBe('number')
      expect(isRight(q, q.answer), q.id).toBe(true)
    }
  })
  it('every lesson has a quiz and links to existing exercises and scenarios', () => {
    for (const l of ALL_LESSONS) {
      expect(l.quiz.length, l.id).toBeGreaterThanOrEqual(5)
      for (const p of l.practice ?? []) {
        if (p.exercise) expect(exercise(p.exercise), p.exercise).toBeTruthy()
        if (p.scenario)
          expect(
            SCENARIOS.some((s) => s.id === p.scenario),
            p.scenario,
          ).toBe(true)
      }
    }
  })
  it('model interview answers cover all their own key points', () => {
    for (const q of ALL_INTERVIEW) {
      const model = typeof q.model === 'string' ? q.model : q.model.ru
      const cov = coveredPoints(q.points, model)
      expect(cov.every(Boolean), `${q.id}: ${cov}`).toBe(true)
    }
  })
  it('glossary has the main old/new pairs', () => {
    expect(GLOSSARY.find((g) => g.old === 'FoxView')?.now).toMatch(/Control HMI/)
  })
})

describe('answer checking', () => {
  const q = ALL_QUESTIONS.find((x) => x.kind === 'multi')!
  it('multi needs the exact set', () => {
    const a = q.answer as number[]
    expect(isRight(q, [...a].reverse())).toBe(true)
    expect(isRight(q, a.slice(0, -1).concat(a.length === 1 ? [9] : []))).toBe(false)
  })
  it('num tolerance', () => {
    expect(isRight({ id: 'x', kind: 'num', q: '', answer: 2, explain: '' }, 2)).toBe(true)
    expect(isRight({ id: 'x', kind: 'num', q: '', answer: 2, tol: 0.1, explain: '' }, 2.05)).toBe(true)
    expect(isRight({ id: 'x', kind: 'num', q: '', answer: 2, explain: '' }, 3)).toBe(false)
  })
})

describe('spaced repetition', () => {
  const D = 86_400_000
  it('wrong → 1 day, then 3, then 7, then learned', () => {
    let s = srsNext({}, 'q', false, 0)
    expect(s.q).toEqual({ box: 0, due: D })
    expect(dueIds(s, D - 1)).toEqual([])
    expect(dueIds(s, D)).toEqual(['q'])
    s = srsNext(s, 'q', true, D)
    expect(s.q).toEqual({ box: 1, due: D + 3 * D })
    s = srsNext(s, 'q', true, 4 * D)
    expect(s.q.box).toBe(2)
    s = srsNext(s, 'q', true, 11 * D)
    expect(s.q).toBeUndefined()
  })
  it('right answer before due keeps the schedule; right answer of unseen question adds nothing', () => {
    const s = srsNext({}, 'q', false, 0)
    expect(srsNext(s, 'q', true, 10)).toBe(s)
    expect(srsNext({}, 'z', true, 0)).toEqual({})
  })
})
