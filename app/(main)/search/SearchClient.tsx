'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Dataset, Chunk, DocMeta, Doc, Folder, DEPTS, DOC_TYPES, PreviewState } from '../../lib/ekb-types'
import { getFileIcon, fmtSize, highlight, renderPreviewContent, renderMarkdownPreview } from '../../lib/ekb-utils'

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
  const [docs, setDocs] = useState<Doc[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [previewState, setPreviewState] = useState<PreviewState>({ doc: null, content: '', loading: false })
  const [filterDept, setFilterDept] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterOwner, setFilterOwner] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>()
  const previewReqRef = useRef(0)

  useEffect(() => {
    fetch('/api/datasets').then(r => r.json()).then(d => { setDatasets(d.data || []) })
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!selectedDs) { setDocs([]); setFolders([]); setCurrentFolderId(null); return }
    setLoadingDocs(true)
    Promise.all([
      fetch(`/api/datasets/docs?datasetId=${selectedDs.id}`).then(r => r.json()),
      fetch(`/api/folders?datasetId=${selectedDs.id}`).then(r => r.json()),
    ]).then(([dd, fd]) => {
      setDocs(dd.data || [])
      setFolders(fd.folders || [])
      setLoadingDocs(false)
    }).catch(() => setLoadingDocs(false))
  }, [selectedDs])

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

  async function handlePreview(doc: Doc) {
    if (!selectedDs) return
    setPreviewState({ doc, content: '', loading: true })
    const ext = doc.name.split('.').pop()?.toLowerCase() || ''
    if (ext === 'pdf') { setPreviewState({ doc, content: '__pdf__', loading: false }); return }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      setPreviewState({ doc, content: '__image__', loading: false }); return
    }
    const reqId = ++previewReqRef.current
    try {
      const r = await fetch(`/api/datasets/docs/download?datasetId=${selectedDs.id}&docId=${doc.id}`)
      if (reqId !== previewReqRef.current) return
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        if (reqId !== previewReqRef.current) return
        setPreviewState({ doc, content: `⚠️ ${d.error || '无法加载预览'}`, loading: false }); return
      }
      if (['md', 'txt'].includes(ext)) {
        const text = await r.text()
        if (reqId !== previewReqRef.current) return
        setPreviewState({ doc, content: text.slice(0, 30000), loading: false })
      } else if (ext === 'csv') {
        const text = await r.text()
        if (reqId !== previewReqRef.current) return
        setPreviewState({ doc, content: '__csv__:' + text.slice(0, 60000), loading: false })
      } else {
        setPreviewState({ doc, content: '__binary__', loading: false })
      }
    } catch {
      if (reqId === previewReqRef.current) setPreviewState({ doc, content: '加载失败，请尝试下载', loading: false })
    }
  }

  function handleDownload(doc: Doc) {
    if (!selectedDs) return
    const url = `/api/datasets/docs/download?datasetId=${selectedDs.id}&docId=${doc.id}`
    const a = document.createElement('a'); a.href = url; a.download = doc.name
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
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

  const currentFolder = currentFolderId ? folders.find(f => f.id === currentFolderId) || null : null

  const visibleDocs = useMemo(() => {
    const active = docs.filter(d => !d.meta?.deleted)
    if (!currentFolderId) return active
    const folder = folders.find(f => f.id === currentFolderId)
    if (!folder) return []
    return active.filter(d => folder.docIds.includes(d.id))
  }, [docs, folders, currentFolderId])

  const browseMode = !query && selectedDs !== null

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
                : browseMode
                ? '浏览「' + selectedDs.name + '」' + (currentFolder ? ' / ' + currentFolder.name : '') + ' — ' + visibleDocs.length + ' 个文件'
                : '输入关键词即时检索，或选择知识库浏览文件'}
            </p>
          </div>
          {query && (
            <button onClick={clearSearch} style={{ padding: '8px 14px', background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, color: '#64748b', cursor: 'pointer' }}>
              清除
            </button>
          )}
        </div>

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <svg style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, color: '#94a3b8', pointerEvents: 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input ref={inputRef} value={inputVal} onChange={e => setInputVal(e.target.value)}
            placeholder={browseMode ? '在「' + selectedDs.name + '」中搜索…' : '搜索文档内容、标题、关键词…输入即开始检索'}
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
          <button onClick={() => { setSelectedDs(null); setCurrentFolderId(null) }} style={tabStyle(selectedDs === null)}>全部知识库</button>
          {datasets.map(ds => (
            <button key={ds.id} onClick={() => { setSelectedDs(ds); setCurrentFolderId(null) }} style={tabStyle(selectedDs?.id === ds.id)}>{ds.name}</button>
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

      {browseMode && (
        <div style={{ background: '#fff', borderBottom: '1px solid #e8edf5', padding: '8px 28px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button onClick={() => setCurrentFolderId(null)} style={{ fontSize: 13, color: currentFolderId ? '#2563eb' : '#0f172a', fontWeight: currentFolderId ? 500 : 700, background: 'none', border: 'none', cursor: currentFolderId ? 'pointer' : 'default', padding: 0, textDecoration: currentFolderId ? 'underline' : 'none' }}>
            {selectedDs.name}
          </button>
          {currentFolder && (
            <>
              <span style={{ color: '#94a3b8', fontSize: 14 }}>›</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{currentFolder.name}</span>
            </>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>
            {loadingDocs ? '加载中…' : visibleDocs.length + ' 个文件'}
          </span>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>

        {!query && !selectedDs && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <svg style={{ width: 32, height: 32, color: '#3b82f6' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>输入关键词开始检索，或选择知识库浏览</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.75, maxWidth: 380 }}>
              语义检索无需精确匹配。点击下方知识库可直接浏览文件，支持预览 Markdown、文本、图片等格式。
            </p>
            {datasets.length > 0 && (
              <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                {datasets.map(ds => (
                  <button key={ds.id} onClick={() => { setSelectedDs(ds); setCurrentFolderId(null) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, background: '#fff', border: '1.5px solid #e2e8f0', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#0f172a', transition: 'all 0.15s' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#3b82f6'; el.style.boxShadow = '0 4px 12px rgba(59,130,246,.1)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#e2e8f0'; el.style.boxShadow = 'none' }}>
                    <span style={{ fontSize: 18 }}>📚</span>
                    {ds.name}
                    {ds.document_count != null && <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>{ds.document_count} 文件</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {browseMode && (
          <div style={{ padding: '20px 28px' }}>
            {loadingDocs ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12, color: '#64748b', fontSize: 14 }}>
                <svg style={{ width: 20, height: 20, animation: 'spin 0.8s linear infinite' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z" />
                </svg>
                加载中…
              </div>
            ) : (
              <>
                {!currentFolderId && folders.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>文件夹</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
                      {folders.map(folder => (
                        <button key={folder.id} onClick={() => setCurrentFolderId(folder.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#fff', border: '1.5px solid #e8edf5', borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#bfdbfe'; el.style.boxShadow = '0 4px 12px rgba(59,130,246,.1)' }}
                          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#e8edf5'; el.style.boxShadow = 'none' }}>
                          <span style={{ fontSize: 22, flexShrink: 0 }}>📁</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{folder.docIds.length} 个文件</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {visibleDocs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 13 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
                    <div>{currentFolderId ? '此文件夹暂无文件' : '此知识库暂无文件'}</div>
                  </div>
                ) : (
                  <div>
                    {!currentFolderId && folders.length > 0 && (
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>全部文件</div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {visibleDocs.map(doc => {
                        const fi = getFileIcon(doc.name)
                        const meta = doc.meta || {}
                        return (
                          <div key={doc.id} onClick={() => handlePreview(doc)}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff', border: '1.5px solid #e8edf5', borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s' }}
                            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#bfdbfe'; el.style.boxShadow = '0 4px 14px rgba(59,130,246,.09)'; el.style.transform = 'translateY(-1px)' }}
                            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#e8edf5'; el.style.boxShadow = 'none'; el.style.transform = 'translateY(0)' }}>
                            <div style={{ width: 38, height: 38, background: fi.bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: fi.color }}>{fi.label}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                                {meta.dept && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8', fontWeight: 500 }}>{meta.dept}</span>}
                                {meta.type && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 999, background: '#f3e8ff', color: '#7c3aed', fontWeight: 500 }}>{meta.type}</span>}
                                {meta.uploadedBy && <span style={{ fontSize: 11, color: '#94a3b8' }}>↑ {meta.uploadedBy}</span>}
                                {doc.size > 0 && <span style={{ fontSize: 11, color: '#94a3b8' }}>{fmtSize(doc.size)}</span>}
                                {doc.create_date && <span style={{ fontSize: 11, color: '#94a3b8' }}>{doc.create_date.slice(0, 10)}</span>}
                              </div>
                            </div>
                            <svg style={{ width: 16, height: 16, color: '#cbd5e1', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
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

      {previewState.doc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setPreviewState({ doc: null, content: '', loading: false }) }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,.22)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e8edf5', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {(() => {
                  const fi = getFileIcon(previewState.doc.name)
                  return <div style={{ width: 34, height: 34, background: fi.bg, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 11, fontWeight: 800, color: fi.color }}>{fi.label}</span></div>
                })()}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewState.doc.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    {fmtSize(previewState.doc.size)}
                    {previewState.doc.create_date ? ' · ' + previewState.doc.create_date.slice(0, 10) : ''}
                    {previewState.doc.meta?.uploadedBy ? ' · ' + previewState.doc.meta.uploadedBy : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => handleDownload(previewState.doc!)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  下载
                </button>
                <button onClick={() => setPreviewState({ doc: null, content: '', loading: false })}
                  style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 300 }}>
                  ×
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
              {previewState.loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12, color: '#64748b', fontSize: 14 }}>
                  <svg style={{ width: 20, height: 20, animation: 'spin 0.8s linear infinite' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z" />
                  </svg>
                  加载预览中…
                </div>
              ) : (
                previewState.doc.name.toLowerCase().endsWith('.md') &&
                !previewState.content.startsWith('__') &&
                !previewState.content.startsWith('⚠️')
                  ? renderMarkdownPreview(previewState.content, selectedDs?.id || '', previewState.doc.id)
                  : renderPreviewContent(previewState, selectedDs?.id || '', previewState.doc.name)
              )}
            </div>
          </div>
        </div>
      )}

      <style>{'@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }'}</style>
    </div>
  )
}
