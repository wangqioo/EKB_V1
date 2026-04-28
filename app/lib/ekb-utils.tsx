// EKB Shared Utility Functions
// Used by both LibraryClient and SearchClient components

import type { Doc, DocMeta } from './ekb-types'
import type { PreviewState } from './ekb-types'

export function getFileIcon(name: string) {
  const ext = (name || '').split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return { bg: '#fee2e2', color: '#dc2626', label: 'PDF' }
  if (['doc', 'docx'].includes(ext)) return { bg: '#dbeafe', color: '#2563eb', label: 'DOC' }
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { bg: '#dcfce7', color: '#16a34a', label: 'XLS' }
  if (['ppt', 'pptx'].includes(ext)) return { bg: '#ffedd5', color: '#ea580c', label: 'PPT' }
  if (['md', 'txt'].includes(ext)) return { bg: '#f3e8ff', color: '#7c3aed', label: 'TXT' }
  return { bg: '#f1f5f9', color: '#64748b', label: ext.toUpperCase().slice(0, 3) || 'FILE' }
}

export function fmtSize(b?: number) {
  if (!b) return '-'
  if (b < 1024) return `${b}B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)}KB`
  return `${(b / 1048576).toFixed(1)}MB`
}

export function highlight(text: string, query: string): React.ReactNode[] {
  if (!query.trim() || !text) return [text || '']
  const words = query.trim().split(/\s+/).filter(Boolean)
  const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(pattern)
  return parts.map((part, i) =>
    pattern.test(part)
      ? <mark key={i} style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: 3, padding: '0 2px', fontWeight: 600 }}>{part}</mark>
      : part
  )
}

export function renderPreviewContent(
  previewState: PreviewState,
  datasetId: string,
  docName: string
) {
  const ext = docName.split('.').pop()?.toLowerCase() || ''
  const dlUrl = `/api/datasets/docs/download?datasetId=${datasetId}&docId=${previewState.doc?.id}`

  if (previewState.content === '__pdf__') {
    return <iframe src={dlUrl} style={{ width: '100%', height: '68vh', border: 'none', borderRadius: 6 }} title={docName} />
  }

  if (previewState.content === '__image__') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px 0' }}>
        <img src={dlUrl} alt={docName} style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 6 }} />
      </div>
    )
  }

  if (previewState.content.startsWith('__csv__:')) {
    const csvData = previewState.content.slice(8)
    return (
      <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {csvData.split('\n')[0]?.split(',').map((h, i) => (
                <th key={i} style={{ border: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>{h.trim()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {csvData.split('\n').slice(1).map((row, ri) => (
              <tr key={ri}>
                {row.split(',').map((cell, ci) => (
                  <td key={ci} style={{ border: '1px solid #e2e8f0', padding: '4px 8px' }}>{cell.trim()}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (previewState.content === '__binary__') {
    return <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>此文件类型不支持预览，请下载查看</p>
  }

  if (previewState.content.startsWith('⚠️')) {
    return <p style={{ color: '#dc2626', textAlign: 'center', padding: '20px' }}>{previewState.content}</p>
  }

  // Plain text / markdown preview
  return <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.7, maxHeight: '70vh', overflow: 'auto', padding: '12px' }}>{previewState.content}</pre>
}

export function renderMarkdownPreview(content: string, datasetId: string, docId: string) {
  const inlineMd = (text: string): any[] => {
    const result: any[] = []
    let i = 0, k = 0
    while (i < text.length) {
      if (text.slice(i, i + 3) === '***') {
        const end = text.indexOf('***', i + 3)
        if (end !== -1) { result.push(<strong key={k++}><em>{text.slice(i + 3, end)}</em></strong>); i = end + 3; continue }
      }
      if (text.slice(i, i + 2) === '**') {
        const end = text.indexOf('**', i + 2)
        if (end !== -1) { result.push(<strong key={k++}>{text.slice(i + 2, end)}</strong>); i = end + 2; continue }
      }
      if (text[i] === '*') {
        const end = text.indexOf('*', i + 1)
        if (end !== -1) { result.push(<em key={k++}>{text.slice(i + 1, end)}</em>); i = end + 1; continue }
      }
      if (text[i] === '`') {
        const end = text.indexOf('`', i + 1)
        if (end !== -1) { result.push(<code key={k++} style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontSize: '0.88em', fontFamily: 'monospace', color: '#1e293b' }}>{text.slice(i + 1, end)}</code>); i = end + 1; continue }
      }
      if (text[i] === '[') {
        const be = text.indexOf(']', i)
        if (be !== -1 && text[be + 1] === '(') {
          const pe = text.indexOf(')', be + 2)
          if (pe !== -1) { result.push(<a key={k++} href={text.slice(be + 2, pe)} target='_blank' rel='noopener noreferrer' style={{ color: '#2563eb', textDecoration: 'underline' }}>{text.slice(i + 1, be)}</a>); i = pe + 1; continue }
        }
      }
      result.push(text[i]); i++
    }
    return result
  }

  const els: any[] = []
  const lines = content.split('\n')
  let li = 0
  while (li < lines.length) {
    const line = lines[li]
    if (line.startsWith('```')) {
      const codeLines: string[] = []; li++
      while (li < lines.length && !lines[li].startsWith('```')) { codeLines.push(lines[li]); li++ }
      els.push(<pre key={li} style={{ background: '#1e293b', color: '#e2e8f0', padding: '14px 16px', borderRadius: 8, fontSize: 12.5, overflowX: 'auto', margin: '12px 0', lineHeight: 1.65, fontFamily: 'monospace' }}>{codeLines.join('\n')}</pre>)
      li++; continue
    }
    const h1m = line.match(/^# (.+)/); if (h1m) { els.push(<h1 key={li} style={{ fontSize: 20, fontWeight: 800, margin: '24px 0 12px', color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: 8 }}>{inlineMd(h1m[1])}</h1>); li++; continue }
    const h2m = line.match(/^## (.+)/); if (h2m) { els.push(<h2 key={li} style={{ fontSize: 17, fontWeight: 700, margin: '20px 0 10px', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: 5 }}>{inlineMd(h2m[1])}</h2>); li++; continue }
    const h3m = line.match(/^### (.+)/); if (h3m) { els.push(<h3 key={li} style={{ fontSize: 15, fontWeight: 700, margin: '16px 0 8px', color: '#1e293b' }}>{inlineMd(h3m[1])}</h3>); li++; continue }
    const h4m = line.match(/^#### (.+)/); if (h4m) { els.push(<h4 key={li} style={{ fontSize: 14, fontWeight: 700, margin: '14px 0 7px', color: '#374151' }}>{inlineMd(h4m[1])}</h4>); li++; continue }
    if (line.match(/^(-{3,}|_{3,}|\*{3,})$/)) { els.push(<hr key={li} style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '16px 0' }} />); li++; continue }
    if (line.startsWith('> ')) { els.push(<blockquote key={li} style={{ margin: '10px 0', padding: '8px 14px', background: '#f8fafc', borderLeft: '3px solid #cbd5e1', color: '#475569', fontSize: 13, borderRadius: '0 6px 6px 0' }}>{inlineMd(line.slice(2))}</blockquote>); li++; continue }
    if (line.match(/^[-*+] /)) {
      const items: string[] = []
      while (li < lines.length && lines[li].match(/^[-*+] /)) { items.push(lines[li].slice(2)); li++ }
      els.push(<ul key={li} style={{ margin: '8px 0', paddingLeft: 22 }}>{items.map((it, j) => <li key={j} style={{ fontSize: 13.5, color: '#374151', margin: '3px 0', lineHeight: 1.65 }}>{inlineMd(it)}</li>)}</ul>)
      continue
    }
    if (line.match(/^\d+\. /)) {
      const items: string[] = []
      while (li < lines.length && lines[li].match(/^\d+\. /)) { items.push(lines[li].replace(/^\d+\. /, '')); li++ }
      els.push(<ol key={li} style={{ margin: '8px 0', paddingLeft: 22 }}>{items.map((it, j) => <li key={j} style={{ fontSize: 13.5, color: '#374151', margin: '3px 0', lineHeight: 1.65 }}>{inlineMd(it)}</li>)}</ol>)
      continue
    }
    if (line.trim() === '') { els.push(<div key={li} style={{ height: 6 }} />); li++; continue }
    els.push(<p key={li} style={{ fontSize: 13.5, color: '#374151', margin: '5px 0', lineHeight: 1.8 }}>{inlineMd(line)}</p>)
    li++
  }
  return <div style={{ lineHeight: 1.8, maxWidth: '100%' }}>{els}</div>
}
