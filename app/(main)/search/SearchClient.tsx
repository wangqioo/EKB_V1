'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Dataset, Chunk, DocMeta, DEPTS, DOC_TYPES } from '../../lib/ekb-types'
import { getFileIcon, highlight } from '../../lib/ekb-utils'

interface Props { userName: string; role: string; permissionLevel: number }

export default function SearchClient({ userName, role, permissionLevel }: Props) {
  const [inputVal, setInputVal] = useState('')
  const [query, setQuery] = useState('')
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [docMeta, setDocMeta] = useState<Record<string, DocMeta>>({})
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDs, setSelectedDs] = useState<Dataset | null>(null)
  const [filterDept, setFilterDept] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterOwner, setFilterOwner] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>()

  useEffect(() => {
    fetch('/api/datasets').then(r => r.json()).then(d => { setDatasets(d.data || []) })
    inputRef.current?.focus()
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setChunks([]); setSearchError(''); return }
    setLoadingSearch(true); setSearchError('')
    const params = new URLSearchParams({ q })
    if (selectedDs?.id) params.set('datasetIds', selectedDs.id)
    try {
      const r = await fetch('/api/search?' + params)
      const d = await r.json()
      if (d.error) { setSearchError(d.error); setChunks([]) }
      else {
        const cs: Chunk[] = (d.chunks || []).map((c: any) => ({ ...c, docName: c.docName || '未知文档' }))
        setChunks(cs)
        const docIds = Array.from(new Set(cs.map((c: Chunk) => c.docId)))
        if (docIds.length > 0) {
          fetch('/api/doc-meta?docIds=' + docIds.join(',')).then(r => r.json()).then(d => setDocMeta(d.data || {}))
        }
      }
    } catch { setSearchError('搜索请求失败，请稍后重试') }
    setLoadingSearch(false)
  }, [selectedDs])

  useEffect(() => {
    const q = inputVal.trim()
    clearTimeout(debounceRef.current)
    if (!q) { setChunks([]); setQuery(''); setSearchError(''); return }
    debounceRef.current = setTimeout(() => { setQuery(q); doSearch(q) }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [inputVal, doSearch])

  function clearSearch() {
    setInputVal(''); setChunks([]); setQuery(''); setSearchError('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const docMap = new Map<string, Chunk & { allChunks: Chunk[] }>()
  for (const c of chunks) {
    const existing = docMap.get(c.docId)
    if (!existing || c.similarity > existing.similarity) {
      docMap.set(c.docId, { ...c, allChunks: existing ? [...existing.allChunks, c] : [c] })
    } else { existing.allChunks.push(c) }
  }
  let results = Array.from(docMap.values()).sort((a, b) => b.similarity - a.similarity)
  if (filterDept) results = results.filter(r => docMeta[r.docId]?.dept === filterDept)
  if (filterType) results = results.filter(r => docMeta[r.docId]?.type === filterType)
  if (filterOwner) results = results.filter(r => docMeta[r.docId]?.uploadedBy === filterOwner)
  const hasFilters = !!(filterDept || filterType || filterOwner)

  const availableOwners = useMemo(() => {
    const owners = new Set<string>()
    Object.values(docMeta).forEach(m => { if (m?.uploadedBy) owners.add(m.uploadedBy) })
    return Array.from(owners).sort()
  }, [docMeta])

  const tabStyle = (active: boolean) => ({
    padding: '7px 16px', border: 'none', fontSize: 13,
    fontWeight: active ? 700 : 500, cursor: 'pointer' as const,
    background: 'none', color: active ? '#2563eb' : '#64748b',
    borderBottom: '2.5px solid ' + (active ? '#2563eb' : 'transparent'),
    marginBottom: -1, transition: 'all 0.15s',
  })

  const selStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 10px', borderRadius: 7,
    border: '1.5px solid ' + (active ? '#3b82f6' : '#e2e8f0'),
    fontSize: 12, background: active ? '#eff6ff' : '#f8fafc',
    color: active ? '#2563eb' : '#64748b', outline: 'none', cursor: 'pointer',
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

      <div style={{ padding: '20px 28px 0', background: 'rgba(255,255,255,.75)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(59,130,246,.1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>知识检索</h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: '3px 0 0' }}>
              {query
                ? '搜索「' + query + '」— 找到 ' + results.length + ' 份文档' + (selectedDs ? '（' + selectedDs.name + '）' : '（全部知识库）')
                : '输入关键词，即时语义检索知识库'}
            </p>
          </div>
          {query && (
            <button onClick={clearSearch} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, color: '#64748b', cursor: 'pointer' }}>
              清除
            </button>
          )}
        </div>

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <svg style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, color: '#94a3b8', pointerEvents: 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input ref={inputRef} value={inputVal} onChange={e => setInputVal(e.target.value)}
            placeholder="搜索文档内容、标题、关键词…输入即开始检索"
            style={{ width: '100%', padding: '16px 52px', borderRadius: 14, border: '2px solid #c7d8f8', fontSize: 16, color: '#0f172a', outline: 'none', background: '#fff', boxSizing: 'border-box', boxShadow: '0 4px 24px rgba(59,130,246,.10)', transition: 'border-color 0.2s' }}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#3b82f6' }}
            onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#c7d8f8' }}
          />
          {loadingSearch && (
            <div style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)' }}>
              <svg style={{ width: 18, height: 18, color: '#3b82f6', animation: 'spin 0.8s linear infinite' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z" />
              </svg>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <button onClick={() => setSelectedDs(null)} style={tabStyle(selectedDs === null)}>全部知识库</button>
          {datasets.map(ds => (
            <button key={ds.id} onClick={() => setSelectedDs(ds)} style={tabStyle(selectedDs?.id === ds.id)}>{ds.name}</button>
          ))}
        </div>
      </div>

      {query && (
        <div style={{ background: '#fff', borderBottom: '1px solid #e8edf5', padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>筛选</span>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={selStyle(!!filterDept)}>
            <option value="">全部部门</option>
            {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selStyle(!!filterType)}>
            <option value="">全部类型</option>
            {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} style={selStyle(!!filterOwner)}>
            <option value="">全部上传者</option>
            {availableOwners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {hasFilters && (
            <button onClick={() => { setFilterDept(''); setFilterType(''); setFilterOwner('') }}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#ef4444', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              清除筛选
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>
            {loadingSearch ? '检索中…'
              : results.length > 0 ? results.length + ' 份文档，共 ' + chunks.length + ' 个段落' + (hasFilters ? '（已筛选）' : '')
              : query ? '暂无结果' : ''}
          </span>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        {!query && !loadingSearch && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <svg style={{ width: 32, height: 32, color: '#3b82f6' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>输入关键词，即时开始检索</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.75, maxWidth: 360 }}>
              支持语义检索，无需精确词语匹配。选择「全部知识库」可跨库搜索所有文档。
            </p>
            {datasets.length > 0 && (
              <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>可用知识库：</span>
                {datasets.map(ds => (
                  <span key={ds.id} style={{ fontSize: 12, padding: '2px 10px', borderRadius: 999, background: '#eff6ff', color: '#2563eb', fontWeight: 500 }}>{ds.name}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {loadingSearch && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12, color: '#64748b', fontSize: 14 }}>
            <svg style={{ width: 20, height: 20, animation: 'spin 0.8s linear infinite' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z" />
            </svg>
            正在语义检索…
          </div>
        )}

        {searchError && !loadingSearch && (
          <div style={{ margin: '20px 28px', padding: '14px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
            {searchError}
          </div>
        )}

        {!loadingSearch && !searchError && query && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8', fontSize: 13 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <div style={{ fontWeight: 600, color: '#475569', marginBottom: 6 }}>未找到相关内容</div>
            <div>「{query}」在{selectedDs ? '「' + selectedDs.name + '」' : '所有知识库'}中暂无匹配结果</div>
            {selectedDs && (
              <button onClick={() => setSelectedDs(null)} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 10, border: '1.5px solid #c7d8f8', background: '#eff6ff', color: '#2563eb', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                搜索全部知识库
              </button>
            )}
          </div>
        )}

        {!loadingSearch && results.length > 0 && (
          <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {results.map((chunk) => {
              const fi = getFileIcon(chunk.docName)
              const meta = docMeta[chunk.docId] || {}
              const pct = Math.round((chunk.similarity || 0) * 100)
              const raw = (chunk.content || '').replace(/<[^>]+>/g, '').trim()
              const excerpt = raw.length > 300 ? raw.slice(0, 300) + '…' : raw
              return (
                <div key={chunk.id}
                  style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8edf5', padding: '16px 20px', boxShadow: '0 2px 8px rgba(59,130,246,.05)', transition: 'all 0.2s' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = '0 6px 24px rgba(59,130,246,.12)'; el.style.borderColor = '#c7d8f8'; el.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = '0 2px 8px rgba(59,130,246,.05)'; el.style.borderColor = '#e8edf5'; el.style.transform = 'translateY(0)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 38, height: 38, background: fi.bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: fi.color }}>{fi.label}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>{highlight(chunk.docName, query)}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {meta.dept && <span style={{ fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8' }}>{meta.dept}</span>}
                        {meta.type && <span style={{ fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 999, background: '#f3e8ff', color: '#7c3aed' }}>{meta.type}</span>}
                        {meta.uploadedBy && <span style={{ fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 999, background: '#dcfce7', color: '#16a34a' }}>↑ {meta.uploadedBy}</span>}
                        {meta.confidential && <span style={{ fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 999, background: '#fee2e2', color: '#dc2626' }}>机密</span>}
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{chunk.allChunks.length} 个相关段落</span>
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: pct >= 80 ? '#16a34a' : pct >= 60 ? '#2563eb' : '#64748b' }}>{pct}%</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>相关度</div>
                      <div style={{ width: 48, height: 4, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 999, background: pct >= 80 ? 'linear-gradient(90deg,#16a34a,#22c55e)' : pct >= 60 ? 'linear-gradient(90deg,#2563eb,#6366f1)' : '#94a3b8', width: pct + '%' }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.75, padding: '10px 14px', background: '#f8fafc', borderRadius: 8 }}>
                    {highlight(excerpt, query)}
                  </div>
                  {chunk.allChunks.length > 1 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg style={{ width: 12, height: 12 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      另有 {chunk.allChunks.length - 1} 个相关段落命中
                    </div>
                  )}
                </div>
              )
            })}
            <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '8px 0 4px' }}>
              共找到 {results.length} 份文档中的 {chunks.length} 个相关段落
              {selectedDs ? '（在「' + selectedDs.name + '」中）' : '（跨全部知识库）'}
            </div>
          </div>
        )}
      </div>

      <style>{'@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }'}</style>
    </div>
  )
}
