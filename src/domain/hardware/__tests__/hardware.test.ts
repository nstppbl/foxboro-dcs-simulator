import { describe, expect, it } from 'vitest'
import { PRESETS } from '../presets'
import { validateTopology } from '../rules'
import { analyzeNetwork } from '../network'
import { traceSignal } from '../trace'
import { canConnect, nodeIndex } from '../model'

const build = (id: string) => PRESETS.find((p) => p.id === id)!.build()

describe('presets', () => {
  it('classic preset has no errors and is redundant', () => {
    const t = build('classic')
    const issues = validateTopology(t)
    expect(issues.filter((i) => i.severity === 'error')).toEqual([])
    const net = analyzeNetwork(t, new Set())
    expect(net.topology).toBe('linear')
    expect(net.spof).toEqual([])
    expect(net.nonRedundant).toEqual([])
  })

  it('pharma preset is a valid star', () => {
    const t = build('pharma')
    expect(validateTopology(t).filter((i) => i.severity === 'error')).toEqual([])
    expect(analyzeNetwork(t, new Set()).topology).toBe('star')
  })

  it('broken preset reports the planted errors', () => {
    const t = build('broken')
    const msgs = validateTopology(t).map((i) => i.msg.en).join('\n')
    expect(msgs).toMatch(/linear configuration with more than two switches/)
    expect(msgs).toMatch(/Duplicate letterbug "CP0101"/)
    expect(msgs).toMatch(/XX0111/)
    expect(msgs).toMatch(/single MESH connection/)
  })
})

describe('trace', () => {
  it('traces FT101 to a workstation through the FCP270', () => {
    const t = build('classic')
    const r = traceSignal(t, 'ft101', new Set())
    expect(r.broken).toBe(false)
    expect(r.nodeIds).toContain('cp1')
    expect(r.nodeIds).toContain('ws1')
  })
  it('ZCP270 loop goes through the FCM and survives one switch failure', () => {
    const t = build('classic')
    const r = traceSignal(t, 'te201', new Set(['swA']))
    expect(r.broken).toBe(false)
    expect(r.nodeIds).toContain('fcm')
    expect(r.nodeIds).toContain('swB')
  })
  it('breaks when the controller fails', () => {
    const r = traceSignal(build('classic'), 'ft101', new Set(['cp1']))
    expect(r.broken).toBe(true)
  })
})

describe('connect rules', () => {
  it('refuses FBM directly on ZCP270 and instrument on FBM', () => {
    const t = build('classic')
    const i = nodeIndex(t)
    t.nodes.push({ id: 'nf', typeId: 'FBM201', x: 0, y: 0 })
    const fbm = { id: 'nf', typeId: 'FBM201', x: 0, y: 0 }
    expect(canConnect(t, fbm, i.zcp).ok).toBe(false)
    expect(canConnect(t, i.f1, i.ft101).ok).toBe(false)
  })
  it('assigns a compatible free channel', () => {
    const t = build('classic')
    const i = nodeIndex(t)
    t.nodes.push({ id: 'pt', typeId: 'PT', x: 0, y: 0 })
    const r = canConnect(t, i.ta1, { id: 'pt', typeId: 'PT', x: 0, y: 0 })
    expect(r).toMatchObject({ ok: true, kind: 'field', channel: 3 })
    t.nodes.push({ id: 'tc', typeId: 'TE_TC', x: 0, y: 0 })
    expect(canConnect(t, i.ta1, { id: 'tc', typeId: 'TE_TC', x: 0, y: 0 }).ok).toBe(false)
  })
})
