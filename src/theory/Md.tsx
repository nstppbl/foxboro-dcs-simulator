import { Fragment, type ReactNode } from 'react'

/**
 * Tiny Markdown subset for lesson texts (no HTML is ever injected):
 * ### heading, paragraphs, - / 1. lists, | tables |, > note, !> warning, ?> tip,
 * ``` code blocks ```, **bold**, `code`, _italic_.
 */
export function Md({ src }: { src: string }) {
  return <div className="md space-y-2">{parse(src)}</div>
}

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|_[^_\s][^_]*_)/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index))
    const t = m[0]
    if (t.startsWith('**')) out.push(<b key={k++}>{t.slice(2, -2)}</b>)
    else if (t.startsWith('`')) out.push(<code key={k++}>{t.slice(1, -1)}</code>)
    else out.push(<i key={k++}>{t.slice(1, -1)}</i>)
    last = m.index + t.length
  }
  if (last < s.length) out.push(s.slice(last))
  return out
}

function parse(src: string): ReactNode[] {
  const lines = src.replace(/\r/g, '').split('\n')
  const out: ReactNode[] = []
  let i = 0
  let k = 0
  while (i < lines.length) {
    const l = lines[i]
    const t = l.trim()
    if (!t) {
      i++
      continue
    }
    if (t.startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) buf.push(lines[i++])
      i++
      out.push(<pre key={k++}>{buf.join('\n')}</pre>)
      continue
    }
    if (t.startsWith('### ')) {
      out.push(<h4 key={k++}>{inline(t.slice(4))}</h4>)
      i++
      continue
    }
    if (t.startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const r = lines[i].trim()
        if (!/^\|[\s:|-]+\|$/.test(r))
          rows.push(
            r
              .slice(1, -1)
              .split('|')
              .map((c) => c.trim()),
          )
        i++
      }
      const [head, ...body] = rows
      out.push(
        <div key={k++} className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                {head.map((c, j) => (
                  <th key={j}>{inline(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, j) => (
                    <td key={j}>{inline(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }
    const box = /^(>|!>|\?>)\s?/.exec(t)
    if (box) {
      const buf: string[] = []
      while (i < lines.length && lines[i].trim().startsWith(box[1])) buf.push(lines[i++].trim().replace(/^(>|!>|\?>)\s?/, ''))
      const cls = box[1] === '!>' ? 'md-warn' : box[1] === '?>' ? 'md-tip' : 'md-note'
      out.push(
        <div key={k++} className={cls}>
          {buf.map((b, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {inline(b)}
            </Fragment>
          ))}
        </div>,
      )
      continue
    }
    if (/^(-|\d+\.)\s/.test(t)) {
      const ordered = /^\d+\./.test(t)
      const items: string[] = []
      while (i < lines.length && /^(-|\d+\.)\s/.test(lines[i].trim())) {
        let item = lines[i].trim().replace(/^(-|\d+\.)\s/, '')
        i++
        // continuation lines (indented)
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*(-|\d+\.)\s/.test(lines[i])) item += ' ' + lines[i++].trim()
        items.push(item)
      }
      const L = ordered ? 'ol' : 'ul'
      out.push(
        <L key={k++}>
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </L>,
      )
      continue
    }
    const buf: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(###\s|\||>|!>|\?>|```|-\s|\d+\.\s)/.test(lines[i].trim())) buf.push(lines[i++].trim())
    out.push(<p key={k++}>{inline(buf.join(' '))}</p>)
  }
  return out
}
