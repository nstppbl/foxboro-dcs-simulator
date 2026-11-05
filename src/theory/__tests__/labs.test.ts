import { describe, expect, it } from 'vitest'
import { LABS, gradeLab } from '../labs'

describe('HLBL labs', () => {
  it.each(LABS.map((l) => l.id))('%s: the model solution passes every case', (id) => {
    const lab = LABS.find((l) => l.id === id)!
    const g = gradeLab(lab, lab.solution)
    for (const c of g) expect(c.results.filter((x) => !x.ok).map((x) => `${c.c.id}: ${x.k.text} (${x.why})`)).toEqual([])
  })
  it.each(LABS.map((l) => l.id))('%s: the starter code does not pass', (id) => {
    const lab = LABS.find((l) => l.id === id)!
    expect(gradeLab(lab, lab.starter).every((c) => c.ok)).toBe(false)
  })
  it('a naive discharge without timeout fails the stuck-valve case', () => {
    const lab = LABS.find((l) => l.id === 'h2-discharge')!
    const naive = 'REACTOR:XV406.IN := TRUE\nWAITUNTIL REACTOR:ZSO406.CIN\nWAITUNTIL REACTOR:LT401.PNT <= 5\nREACTOR:XV406.IN := FALSE\nSENDMSG "DONE"'
    const g = gradeLab(lab, naive)
    expect(g.find((c) => c.c.id === 'normal')!.ok).toBe(true)
    expect(g.find((c) => c.c.id === 'stuck')!.ok).toBe(false)
  })
})
