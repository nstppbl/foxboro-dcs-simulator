import { HelpButton } from '../../help/HelpUi'
import { useEffect, useState } from 'react'
import { bool, num } from '../../engine/blocks/common'
import { compileHlbl } from '../../engine/blocks/hlbl'
import { BLOCK_TYPES } from '../../engine/registry'
import type { Block } from '../../engine/types'
import { key } from '../../engine/types'
import { useLang } from '../../i18n/i18n'
import { TREND_PENS, useSim } from '../../store/sim'
import { Faceplate } from './Faceplate'
import { ParamTable } from './ParamTable'
import { TrendChart } from './TrendChart'
import { fmt, useL } from './ui'

type Page = 'CNTRL' | 'CONFIG' | 'TUNE' | 'ALARMS' | 'TREND' | 'HLBL'

function trendRange(b: Block): [number, number] {
  if (b.type === 'PID' || b.type === 'PIDA') return [num(b.p.LSCI1), num(b.p.HSCI1)]
  if (b.type === 'AIN') return [num(b.p.LSCO1), num(b.p.HSCO1)]
  if (b.type === 'MTR' || b.type === 'DIN' || b.type === 'DOUT') return [0, 1.2]
  if (b.type === 'CALC' || b.type === 'LLAG') return [0, 10]
  return [0, 100]
}

function pensFor(b: Block) {
  const names = TREND_PENS[b.type] ?? []
  const pid = b.type === 'PID' || b.type === 'PIDA'
  return names.map((n) => ({ name: n, scale: pid && n === 'OUT' ? ([num(b.p.LSCO1), num(b.p.HSCO1)] as [number, number]) : undefined }))
}

function HlblEditor({ b }: { b: Block }) {
  const L = useL()
  const set = useSim.getState().set
  const [src, setSrc] = useState(String(b.p.SOURCE))
  useEffect(() => setSrc(String(b.p.SOURCE)), [b])
  const check = compileHlbl(src)
  const dirty = src !== String(b.p.SOURCE)
  const running = bool(b.p.ACTIVE)
  const line = num(b.p.STMNO)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-on" disabled={!dirty || !!check.error || running} onClick={() => set(b.compound, b.name, 'SOURCE', src, true)}>
          {L('Compile & download', 'Компилировать и загрузить')}
        </button>
        <button className="btn" disabled={running || dirty} onClick={() => set(b.compound, b.name, 'ACTIVE', true)}>
          ▶ ACTIVE := TRUE
        </button>
        <button className="btn" disabled={!running} onClick={() => set(b.compound, b.name, 'ACTIVE', false)}>
          ■ ACTIVE := FALSE
        </button>
        <span className="font-mono text-xs">
          STATE <b>{String(b.p.STATE)}</b> · STMNO {line}
        </span>
        {running && <span className="text-[11px] text-gray-600">{L('Stop the program to edit it.', 'Остановите программу, чтобы редактировать.')}</span>}
      </div>
      <div className={`text-xs font-mono px-2 py-1 border ${check.error ? 'bg-red-50 border-red-400 text-red-700' : 'bg-green-50 border-green-500 text-green-800'}`}>
        {check.error ? `Compile error: ${check.error}` : `Compile OK: ${check.code.length} instructions`}
        {String(b.p.PERROR) && <div className="text-red-700">Run-time: {String(b.p.PERROR)}</div>}
      </div>
      <div className="flex font-mono text-[12px] border border-fox-edge bg-white">
        <div className="text-right text-gray-400 select-none py-1 bg-fox-panel2">
          {src.split('\n').map((_, i) => (
            <div key={i} className={`px-2 leading-5 ${running && i + 1 === line ? 'bg-yellow-300 text-black' : ''}`}>
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          className="flex-1 p-1 leading-5 outline-none resize-y min-h-[260px] whitespace-pre"
          spellCheck={false}
          value={src}
          readOnly={running}
          onChange={(e) => setSrc(e.target.value)}
        />
      </div>
      <div className="text-[11px] text-gray-700">
        {L(
          'Statements: x := expr · C:B.P := expr · IF … THEN … ELSE … ENDIF · WHILE … DO … ENDWHILE · WAIT sec · WAITUNTIL cond · SENDMSG "text" · EXIT · -- comment',
          'Операторы: x := expr · C:B.P := expr · IF … THEN … ELSE … ENDIF · WHILE … DO … ENDWHILE · WAIT сек · WAITUNTIL условие · SENDMSG "текст" · EXIT · -- комментарий',
        )}
      </div>
    </div>
  )
}

/** Block Detail Display with the FoxView page set. */
export function BlockDetail({ b }: { b: Block }) {
  const L = useL()
  const { lang } = useLang()
  useSim((s) => s.version)
  const trends = useSim((s) => s.trends)
  const def = BLOCK_TYPES[b.type]
  const pages: Page[] = b.type === 'HLBL' ? ['HLBL', 'CONFIG', 'TREND'] : ['CNTRL', 'CONFIG', 'TUNE', 'ALARMS', 'TREND']
  const [page, setPage] = useState<Page>(pages[0])
  useEffect(() => setPage(b.type === 'HLBL' ? 'HLBL' : 'CNTRL'), [b.type, b.name])
  const ref = key(b.compound, b.name)
  const [lo, hi] = trendRange(b)
  const links = Object.entries(b.links)

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="titlebar">
        <span>
          {ref} · {b.type}
        </span>
        <span className="normal-case font-normal opacity-80 truncate">{String(b.p.DESCRP)}</span>
        <HelpButton topic={`block:${b.type}`} light />
      </div>
      <div className="flex flex-wrap gap-0 border-b border-fox-edge bg-fox-panel">
        {pages.map((p) => (
          <button key={p} onClick={() => setPage(p)} className={`px-3 py-1 text-xs font-mono border-r border-fox-edge ${page === p ? 'bg-white font-bold' : 'hover:bg-fox-panel2'}`}>
            {p}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-2">
        {page === 'CNTRL' && (
          <div className="flex flex-col xl:flex-row gap-3">
            <Faceplate b={b} />
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-xs text-gray-800">{def.desc[lang]}</p>
              <TrendChart buf={trends[ref]} pens={pensFor(b)} lo={lo} hi={hi} height={180} />
              {links.length > 0 && (
                <div className="text-xs">
                  <div className="font-semibold mb-1">{L('Connections (secured inputs)', 'Связи (защищённые входы)')}</div>
                  <div className="font-mono grid grid-cols-[auto_1fr] gap-x-3">
                    {links.map(([p, src]) => (
                      <div key={p} className="contents">
                        <span>
                          {b.name}.{p} ←
                        </span>
                        <span className="text-fox-navy">
                          {src} = {fmt(b.p[p])}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <ParamTable b={b} groups={['control', 'status']} />
            </div>
          </div>
        )}
        {page === 'CONFIG' && (
          <>
            <p className="text-[11px] text-gray-700 mb-2">
              {L(
                'Configurator view: every parameter can be changed here, connections use C:B.P or :B.P. (Operator displays allow only settable parameters.)',
                'Режим конфигуратора: здесь можно менять любой параметр, связи задаются как C:B.P или :B.P. (С операторских дисплеев меняются только settable параметры.)',
              )}
            </p>
            <ParamTable b={b} config showLinks />
          </>
        )}
        {page === 'TUNE' && <ParamTable b={b} groups={['tune']} />}
        {page === 'ALARMS' && <ParamTable b={b} groups={['alarm', 'status']} />}
        {page === 'TREND' && <TrendChart buf={trends[ref]} pens={pensFor(b)} lo={lo} hi={hi} height={360} />}
        {page === 'HLBL' && <HlblEditor b={b} />}
      </div>
    </div>
  )
}
