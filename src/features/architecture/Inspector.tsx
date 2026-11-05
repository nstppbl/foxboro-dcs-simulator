import { Activity, Trash2, Zap, ZapOff } from 'lucide-react'
import { SIGNAL_LABEL } from '../../domain/hardware/catalog'
import { channelMap, familyOf, fbmController, fbmHost, linksOf, neighbors, nodeIndex, nodeName, otherEnd, typeOf, usedChannels } from '../../domain/hardware/model'
import { useT } from '../../i18n/i18n'
import { useTopology } from '../../store/topology'

export function Inspector() {
  const { t, tb } = useT()
  const s = useTopology()
  const sel = s.selected
  const idx = nodeIndex(s)

  if (!sel)
    return (
      <Shell title={t('inspector')}>
        <p className="text-xs text-gray-600 p-2">{t('noSelection')}</p>
      </Shell>
    )

  if (sel.kind === 'link') {
    const l = s.links.find((x) => x.id === sel.id)
    if (!l) return null
    const a = idx[l.a]
    const b = idx[l.b]
    return (
      <Shell title={t('link')}>
        <div className="p-2 space-y-1 text-xs">
          <Row k={t('type')} v={l.kind} />
          <Row k="A" v={a ? nodeName(a) : '?'} />
          <Row k="B" v={b ? nodeName(b) : '?'} />
          {l.channel && <Row k={t('channel')} v={`${l.channel} (${SIGNAL_LABEL[l.signal!]})`} />}
          <button className="btn mt-2" onClick={s.removeSelected}>
            <Trash2 size={12} /> {t('delete')}
          </button>
        </div>
      </Shell>
    )
  }

  const n = idx[sel.id]
  if (!n) return null
  const ct = typeOf(n)
  const fam = ct.family
  const failed = s.failed.includes(n.id)

  return (
    <Shell title={`${t('inspector')} · ${ct.label}`}>
      <div className="p-2 space-y-2 text-xs overflow-y-auto">
        <p className="text-gray-800 leading-snug">{tb(ct.desc)}</p>
        {ct.src && (
          <p className="text-[10px] text-gray-500">
            {t('manualRef')} {ct.src}
          </p>
        )}

        {(fam !== 'instrument' && fam !== 'ta') && (
          <label className="block">
            <span className="lbl">{t('letterbug')}</span>
            <input
              className="field uppercase"
              maxLength={6}
              value={n.letterbug ?? ''}
              onChange={(e) => s.updateNode(n.id, { letterbug: e.target.value.toUpperCase() })}
            />
            {fam === 'fbm' && (
              <span className="text-[10px] text-gray-600">
                {tb({ en: '1-4: host FCP/FCM · 5: baseplate · 6: position', ru: '1-4: хост FCP/FCM · 5: базовая плата · 6: позиция' })}
              </span>
            )}
          </label>
        )}

        {fam === 'instrument' && (
          <>
            <label className="block">
              <span className="lbl">{t('tag')}</span>
              <input className="field uppercase" value={n.tag ?? ''} onChange={(e) => s.updateNode(n.id, { tag: e.target.value.toUpperCase() })} />
            </label>
            {n.lo !== undefined && (
              <div>
                <span className="lbl">{t('range')}</span>
                <div className="flex gap-1">
                  <input className="field" type="number" value={n.lo} onChange={(e) => s.updateNode(n.id, { lo: +e.target.value })} />
                  <input className="field" type="number" value={n.hi} onChange={(e) => s.updateNode(n.id, { hi: +e.target.value })} />
                  <input className="field" value={n.eu ?? ''} onChange={(e) => s.updateNode(n.id, { eu: e.target.value })} />
                </div>
              </div>
            )}
            <Row k="Signal" v={SIGNAL_LABEL[ct.signal!]} />
          </>
        )}

        {fam === 'switch' && (
          <>
            <div>
              <span className="lbl">{t('side')}</span>
              <div className="flex gap-1">
                {(['A', 'B'] as const).map((sd) => (
                  <button key={sd} className={`btn ${n.side === sd ? 'btn-on' : ''}`} onClick={() => s.updateNode(n.id, { side: sd })}>
                    {sd}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="lbl">{t('role')}</span>
              <div className="flex gap-1">
                {(['root', 'edge'] as const).map((r) => (
                  <button key={r} className={`btn ${n.role === r ? 'btn-on' : ''}`} onClick={() => s.updateNode(n.id, { role: r })}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <Row k={tb({ en: 'Ports used', ru: 'Занято портов' })} v={`${linksOf(s, n.id).length} / ${ct.ports}`} />
          </>
        )}

        {fam === 'controller' && (
          <>
            {ct.maxFbms !== undefined && ct.maxFbms > 0 && <Row k={`${t('capacity')} FBM`} v={`${neighbors(s, n.id, 'fieldbus').length} / ${ct.maxFbms}`} />}
            {n.typeId === 'ZCP270' && (
              <>
                <Row k="FCM100Et" v={`${neighbors(s, n.id, 'host').length}`} />
                <Row k={`${t('capacity')} FBM`} v={`${neighbors(s, n.id, 'host').flatMap((f) => neighbors(s, f.id, 'fieldbus')).length} / 128`} />
              </>
            )}
            <Row k="Max blocks" v={String(ct.maxBlocks)} />
          </>
        )}

        {fam === 'fcm' && <Row k={`${t('capacity')} FBM`} v={`${neighbors(s, n.id, 'fieldbus').length} / ${ct.maxFbms}`} />}

        {fam === 'fbm' && (
          <>
            <Row k="Host" v={fbmHost(s, n.id) ? nodeName(fbmHost(s, n.id)!) : '—'} />
            <Row k="CP" v={fbmController(s, n.id) ? nodeName(fbmController(s, n.id)!) : '—'} />
            <div>
              <span className="lbl">{t('channels')}</span>
              <ChannelTable fbmId={n.id} />
            </div>
          </>
        )}

        <div>
          <span className="lbl">{t('connections')}</span>
          <ul className="font-mono text-[11px]">
            {linksOf(s, n.id).map((l) => (
              <li key={l.id}>
                {l.kind} → {nodeName(idx[otherEnd(l, n.id)])}
                {l.channel ? ` (ch${l.channel})` : ''}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-1 pt-1">
          {fam === 'instrument' && (
            <button className="btn" onClick={() => s.setTrace(n.id)} data-testid="trace-btn">
              <Activity size={12} /> {t('trace')}
            </button>
          )}
          {fam !== 'instrument' && fam !== 'ta' && (
            <button className="btn" onClick={() => s.toggleFail(n.id)}>
              {failed ? <Zap size={12} /> : <ZapOff size={12} />} {failed ? t('restore') : t('fail')}
            </button>
          )}
          <button className="btn" onClick={s.removeSelected}>
            <Trash2 size={12} /> {t('delete')}
          </button>
        </div>
      </div>
    </Shell>
  )
}

function ChannelTable({ fbmId }: { fbmId: string }) {
  const s = useTopology()
  const idx = nodeIndex(s)
  const fbm = idx[fbmId]
  const map = channelMap(typeOf(fbm))
  const used = usedChannels(s, fbmId)
  const ta = neighbors(s, fbmId, 'tacable')[0]
  return (
    <table className="w-full font-mono text-[10px] border border-fox-edge bg-white">
      <tbody>
        {map.map((sig, i) => {
          const l = used.find((u) => u.channel === i + 1)
          const inst = l && ta ? idx[otherEnd(l, ta.id)] : undefined
          return (
            <tr key={i} className="odd:bg-fox-panel2">
              <td className="px-1 w-6">{i + 1}</td>
              <td className="px-1">{sig}</td>
              <td className="px-1 font-semibold">{inst && familyOf(inst) === 'instrument' ? inst.tag : ''}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel h-full flex flex-col min-h-0">
      <div className="titlebar truncate">{title}</div>
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-fox-edge/30">
      <span className="text-gray-600">{k}</span>
      <span className="font-mono">{v}</span>
    </div>
  )
}
