'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Dataset, Doc, DocMeta, Folder, Chunk, DEPTS, DOC_TYPES, STATUS_MAP,
  PreviewState, getFileIcon, fmtSize, highlight, renderPreviewContent,
  renderMarkdownPreview,
} from '../../lib/ekb-types'

interface Props { userName: string; role: string; permissionLevel: number }

export default function SearchClient({ userName, role, permissionLevel }: Props) {
  const isAdmin = permissionLevel >= 2
  const canUpload = permissionLevel >= 1

  // ── Search State ──
  const [query, setQuery] = useState('')
  const [inputVal, setInputVal] = useState('')
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [docMeta, setDocMeta] = useState<Record<string, DocMeta>>({})
  const [showFilters, setShowFilters] = useState(false)

  // ── Dataset Selection ──
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDs, setSelectedDs] = useState<Dataset | null>(null)

  // ── Document Browser State (from LibraryClient) ──
  const [docs, setDocs] = useState<Doc[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)

  // ── Filter State ──
  const [filterDept, setFilterDept] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date')

  // ── Drag & Drop State ──
  const [dragDocId, setDragDocId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)

  // ── Favorites State ──
  const [favIds, setFavIds] = useState(new Set() as Set<string>)

  // ── Preview Modal State ──
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null)
  const [previewContent, setPreviewContent] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewReqRef = useRef(0)

  // ── Trash Modal State ──
  const [showTrash, setShowTrash] = useState(false)
  const [trashDocs, setTrashDocs] = useState<Doc[]>([])
  const [loadingTrash, setLoadingTrash] = useState(false)

  // ── Create Folder State ──
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)

  // Refs
  const inputRef = useRef<HTMLInputElement>(null)
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // ── Load Datasets on Mount ──
  useEffect(() => {
    fetch('/api/datasets').then(r => r.json()).then(d => {
      const list: Dataset[] = d.data || []
      setDatasets(list)
      if (list.length > 0) setSelectedDs(list[0])
    })
    // Load favorites
    fetch('/api/favorites').then(r => r.json()).then(d => {
      if (d.data) setFavIds(new Set(d.data))
    }).catch(() => {})
    inputRef.current?.focus()
  }, [])

  // ── Load Docs & Folders when Dataset Changes ──
  useEffect(() => {
    if (!selectedDs) { setDocs([]); setFolders([]); return }
    setLoadingDocs(true)
    fetch(`/api/datasets/docs?datasetId=${selectedDs.id}`)
      .then(r => r.json())
      .then(d => { setDocs(d.data || []); setLoadingDocs(false) })
      .catch(() => setLoadingDocs(false))
  }, [selectedDs])

  useEffect(() => {
    if (!selectedDs) return
    fetch(`/api/folders?datasetId=${selectedDs.id}`)
      .then(r => r.json())
      .then(d => setFolders(d.data || []))
      .catch(() => {})
  }, [selectedDs])

  // ── Re-search when Dataset Changes ──
  useEffect(() => { if (query && selectedDs) doSearch(query) }, [selectedDs])

  // ── Search Function ──
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setChunks([]); setSearchError(''); return }
    setLoadingSearch(true); setSearchError('')
    const params = new URLSearchParams({ q })
    if (selectedDs?.id) params.set('datasetIds', selectedDs.id)
    try {
      const r = await fetch(`/api/search?${params}`)
      const d = await r.json()
      if (d.error) { setSearchError(d.error); setChunks([]) }
      else {
        const cs: Chunk[] = (d.chunks || []).map((c: any) => ({
          ...c, docName: c.docName || '未知文档',
        }))
        setChunks(cs)
        const docIds = Array.from(new Set(cs.map((c: Chunk) => c.docId)))
        if (docIds.length > 0) {
          fetch(`/api/doc-meta?docIds=${docIds.join(',')}`).then(r => r.json()).then(d => setDocMeta(d.data || {}))
        }
      }
    } catch { setSearchError('搜索请求失败，请稍后重试') }
    setLoadingSearch(false)
  }, [selectedDs])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = inputVal.trim()
    setQuery(q)
    doSearch(q)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { const q = inputVal.trim(); setQuery(q); doSearch(q) }
  }

  function clearSearch() {
    setQuery(''); setInputVal(''); setChunks([]); setSearchError('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  // ── Folder Operations ──
  async function createFolder() {
    if (!newFolderName.trim() || !selectedDs) return
    setCreatingFolder(true)
    const r = await fetch('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datasetId: selectedDs.id, name: newFolderName.trim() }) })
    const data = await r.json()
    setCreatingFolder(false)
    if (data.folder) { setFolders(prev => [...prev, data.folder]); setShowCreateFolder(false); setNewFolderName('') }
  }

  async function deleteFolder(folderId: string) {
    if (!confirm('确认删除此文件夹？文件夹内文件移至根目录。')) return
    await fetch('/api/folders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datasetId: selectedDs!.id, folderId }) })
    setFolders(prev => prev.filter(f => f.id !== folderId))
    if (currentFolderId === folderId) setCurrentFolderId(null)
  }

  async function moveDocToFolder(docId: string, folderId: string) {
    await fetch('/api/folders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datasetId: selectedDs!.id, folderId, addDocIds: [docId] }) })
    await loadFolders()
  }

  async function removeDocFromFolder(docId: string, folderId: string) {
    await fetch('/api/folders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datasetId: selectedDs!.id, folderId, removeDocIds: [docId] }) })
    await loadFolders()
  }

  async function loadFolders() {
    if (!selectedDs) return
    fetch(`/api/folders?datasetId=${selectedDs.id}`)
      .then(r => r.json())
      .then(d => setFolders(d.data || []))
      .catch(() => {})
  }

  // ── Favorites ──
  async function toggleFav(doc: Doc) {
    const isFav = favIds.has(doc.id)
    await fetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docId: doc.id, add: !isFav }) })
    setFavIds(prev => { const n = new Set(prev); isFav ? n.delete(doc.id) : n.add(doc.id); return n })
  }

  // ── Preview ──
  async function handlePreview(doc: Doc) {
    const reqId = ++previewReqRef.current
    setPreviewDoc(doc); setPreviewLoading(true)
    try {
      const r = await fetch(`/api/datasets/docs/preview?datasetId=${selectedDs!.id}&docId=${doc.id}`)
      const d = await r.json()
      if (reqId === previewReqRef.current && !d.error) { setPreviewContent(d.content || '') }
    } catch {}
    setPreviewLoading(false)
  }

  // ── Download ──
  function handleDownload(doc: Doc) {
    window.open(`/api/datasets/docs/download?datasetId=${selectedDs!.id}&docId=${doc.id}`, '_blank')
  }

  // ── Soft Delete / Trash ──
  async function handleSoftDelete(doc: Doc) {
    if (!confirm(`确认将「${doc.name}」移至回收站？`)) return
    await fetch('/api/trash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docId: doc.id, datasetId: selectedDs!.id }) })
    setDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  async function loadTrash() {
    setLoadingTrash(true)
    try {
      const r = await fetch(`/api/trash?datasetId=${selectedDs!.id}`)
      const d = await r.json()
      setTrashDocs(d.data || [])
    } catch {}
    setLoadingTrash(false)
  }

  async function restoreFromTrash(docId: string) {
    await fetch('/api/trash', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docId, datasetId: selectedDs!.id }) })
    setTrashDocs(prev => prev.filter(d => d.id !== docId))
  }

  async function permanentlyDelete(docId: string) {
    if (!confirm('确认永久删除此文件？此操作不可恢复。')) return
    await fetch('/api/trash', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docId, datasetId: selectedDs!.id, permanent: true }) })
    setTrashDocs(prev => prev.filter(d => d.id !== docId))
  }

  // ── Computed Values ──
  const currentFolder = folders.find(f => f.id === currentFolderId) || null
  const allFiledDocIds = new Set(folders.flatMap(f => f.docIds))
  const unfiledDocs = docs.filter(d => !allFiledDocIds.has(d.id))
  let currentDocs = currentFolderId ? docs.filter(d => currentFolder?.docIds.includes(d.id)) : unfiledDocs

  // Apply filters
  if (filterDept) currentDocs = currentDocs.filter(d => d.meta?.dept === filterDept)
  if (filterType) currentDocs = currentDocs.filter(d => d.meta?.type === filterType)
  if (filterSearch) currentDocs = currentDocs.filter(d => d.name.toLowerCase().includes(filterSearch.toLowerCase()))

  // Filter folders by search (when in root view)
  const visibleFolders = (!currentFolderId && filterSearch)
    ? folders.filter(f => f.name.toLowerCase().includes(filterSearch.toLowerCase()))
    : folders
  currentDocs = [...currentDocs].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name, 'zh-CN')
    if (sortBy === 'size') return (b.size || 0) - (a.size || 0)
    return (b.create_time || 0) - (a.create_time || 0)
  })

  const today = new Date().toISOString().slice(0, 10)
  const todayCount = docs.filter(d => d.create_date?.startsWith(today)).length
  const dateStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })

  // ── Search Results Dedup ──
  const docMap = new Map<string, Chunk & { allChunks: Chunk[] }>()
  for (const c of chunks) {
    const existing = docMap.get(c.docId)
    if (!existing || c.similarity > existing.similarity) {
      docMap.set(c.docId, { ...c, allChunks: existing ? [...existing.allChunks, c] : [c] })
    } else {
      existing.allChunks.push(c)
    }
  }
  let results = Array.from(docMap.values()).sort((a, b) => b.similarity - a.similarity)
  if (filterDept) results = results.filter(r => docMeta[r.docId]?.dept === filterDept)
  if (filterType) results = results.filter(r => docMeta[r.docId]?.type === filterType)
  const hasFilters = filterDept || filterType

  // ── Search Box Styles (Larger) ──
  const searchBoxStyle: React.CSSProperties = {
    position: 'relative',
    marginBottom: 16,
  }

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '18px 140px 18px 52px',
    borderRadius: 16,
    border: '2px solid #c7d8f8',
    fontSize: 17,
    color: '#0f172a',
    outline: 'none',
    background: '#fff',
    boxSizing: 'border-box',
    boxShadow: '0 4px 24px rgba(59,130,246,.10)',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  const searchButtonStyle: React.CSSProperties = {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    padding: '10px 24px',
    background: 'linear-gradient(135deg,#2563eb,#6366f1)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(37,99,235,.3)',
  }

  // ── Render ──
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

      {/* Header */}
      <div style={{ padding: '20px 28px 0', background: 'rgba(255,255,255,.75)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(59,130,246,.1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>知识检索</h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: '3px 0 0' }}>
              {query ? `搜索「${query}」的结果` : `${dateStr}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {query && (
              <button onClick={clearSearch}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, color: '#64748b', cursor: 'pointer' }}>
                ← 返回浏览
              </button>
            )}
            {query && (
              <button onClick={() => setShowFilters(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: showFilters ? '#eff6ff' : '#fff', border: `1.5px solid ${showFilters ? '#93c5fd' : '#e2e8f0'}`, borderRadius: 10, fontSize: 13, fontWeight: 500, color: showFilters ? '#2563eb' : '#64748b', cursor: 'pointer' }}>
                <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
                筛选{hasFilters ? ` (${[filterDept, filterType].filter(Boolean).length})` : ''}
              </button>
            )}
          </div>
        </div>

        {/* Large Search Box */}
        <form onSubmit={handleSearch}>
          <div style={searchBoxStyle}>
            <svg style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, color: '#94a3b8', pointerEvents: 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input ref={inputRef} value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="搜索文档内容、标题、关键词..."
              style={searchInputStyle}
              onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#3b82f6'; (e.target as HTMLInputElement).style.boxShadow = '0 4px 28px rgba(59,130,246,.16)' }}
              onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#c7d8f8'; (e.target as HTMLInputElement).style.boxShadow = '0 4px 24px rgba(59,130,246,.10)' }}
            />
            <button type="submit" style={searchButtonStyle}>
              搜索
            </button>
          </div>
        </form>

        {/* Dataset tabs */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {datasets.map(ds => (
            <button key={ds.id} onClick={() => setSelectedDs(ds)}
              style={{ padding: '7px 16px', border: 'none', fontSize: 13, fontWeight: selectedDs?.id === ds.id ? 700 : 500, cursor: 'pointer', background: 'none', color: selectedDs?.id === ds.id ? '#2563eb' : '#64748b', borderBottom: `2.5px solid ${selectedDs?.id === ds.id ? '#2563eb' : 'transparent'}`, marginBottom: -1, transition: 'all 0.15s' }}>
              {ds.name}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar (search mode only) */}
      {query && showFilters && (
        <div style={{ background: '#fff', borderBottom: '1px solid #e8edf5', padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>筛选：</span>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: 7, border: `1.5px solid ${filterDept ? '#3b82f6' : '#e2e8f0'}`, fontSize: 12, background: filterDept ? '#eff6ff' : '#f8fafc', color: filterDept ? '#2563eb' : '#64748b', outline: 'none', cursor: 'pointer' }}>
            <option value="">全部部门</option>
            {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: 7, border: `1.5px solid ${filterType ? '#3b82f6' : '#e2e8f0'}`, fontSize: 12, background: filterType ? '#eff6ff' : '#f8fafc', color: filterType ? '#2563eb' : '#64748b', outline: 'none', cursor: 'pointer' }}>
            <option value="">全部类型</option>
            {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {hasFilters && (
            <button onClick={() => { setFilterDept(''); setFilterType('') }}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#ef4444', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              清除
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>
            {loadingSearch ? '检索中...' : results.length > 0 ? `找到 ${results.length} 份文档` : query ? '暂无结果' : ''}
          </span>
        </div>
      )}

      {/* Main body */}
      <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
        {!selectedDs ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 4px 20px rgba(59,130,246,.12)' }}>
              <svg style={{ width: 32, height: 32, color: '#3b82f6' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>选择知识库或开始搜索</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.7, maxWidth: 340 }}>
              点击上方知识库标签浏览文档，或输入关键词进行全文语义检索
            </p>
          </div>
        ) : query ? (
          /* ── SEARCH MODE ── */
          <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loadingSearch && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12, color: '#64748b', fontSize: 14 }}>
                <svg style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z" />
                </svg>
                正在语义检索...
              </div>
            )}
            {searchError && !loadingSearch && (
              <div style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
                ⚠️ {searchError}
              </div>
            )}
            {!loadingSearch && !searchError && results.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 13 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                未找到与「{query}」相关的文档内容
              </div>
            )}
            {!loadingSearch && results.map((chunk) => {
              const fi = getFileIcon(chunk.docName)
              const meta = docMeta[chunk.docId] || {}
              const pct = Math.round((chunk.similarity || 0) * 100)
              const raw = (chunk.content || '').replace(/<[^>]+>/g, '').trim()
              const excerpt = raw.length > 280 ? raw.slice(0, 280) + '…' : raw
              return (
                <div key={chunk.id}
                  style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8edf5', padding: '16px 20px', boxShadow: '0 2px 8px rgba(59,130,246,.05)', transition: 'all 0.2s', cursor: 'pointer' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = '0 6px 24px rgba(59,130,246,.12)'; el.style.borderColor = '#c7d8f8'; el.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = '0 2px 8px rgba(59,130,246,.05)'; el.style.borderColor = '#e8edf5'; el.style.transform = 'translateY(0)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 38, height: 38, background: fi.bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: fi.color }}>{fi.label}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                        {highlight(chunk.docName, query)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {meta.dept && <span style={{ fontSize: 12, fontWeight: 500, padding: '1px 7px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8' }}>{meta.dept}</span>}
                        {meta.type && <span style={{ fontSize: 12, fontWeight: 500, padding: '1px 7px', borderRadius: 999, background: '#f3e8ff', color: '#7c3aed' }}>{meta.type}</span>}
                        {meta.confidential && <span style={{ fontSize: 12, fontWeight: 500, padding: '1px 7px', borderRadius: 999, background: '#fee2e2', color: '#dc2626' }}>🔒 机密</span>}
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{chunk.allChunks.length} 个相关段落</span>
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: pct >= 80 ? '#16a34a' : pct >= 60 ? '#2563eb' : '#64748b' }}>{pct}%</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>相关度</div>
                      <div style={{ marginTop: 4, width: 48, height: 4, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 999, background: pct >= 80 ? 'linear-gradient(90deg,#16a34a,#22c55e)' : pct >= 60 ? 'linear-gradient(90deg,#2563eb,#6366f1)' : '#94a3b8', width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.75, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                    {highlight(excerpt, query)}
                  </div>
                  {chunk.allChunks.length > 1 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg style={{ width: 12, height: 12 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      另有 {chunk.allChunks.length - 1} 个相关段落命中
                    </div>
                  )}
                </div>
              )
            })}
            {!loadingSearch && results.length > 0 && (
              <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '8px 0 4px' }}>
                共找到 {results.length} 份文档中的 {chunks.length} 个相关段落
              </div>
            )}
          </div>
        ) : (
          /* ── BROWSE MODE (Full LibraryClient Pane) ── */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header bar */}
            <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,.7)', borderBottom: '1px solid #e8edf5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>{selectedDs.name}</span>
                {currentFolderId ? (
                  <>
                    <span style={{ color: '#94a3b8' }}>›</span>
                    <button onClick={() => setCurrentFolderId(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontWeight: 500, fontSize: 13, padding: 0 }}>
                      {currentFolder?.name}
                    </button>
                  </>
                ) : null}
                <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>
                  {currentFolderId ? `${currentDocs.length} 个文件` : `${visibleFolders.length} 个文件夹 · ${currentDocs.length} 个文件`}
                </span>
              </div>
            </div>

            {/* Content area */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* Folder card grid */}
              {!currentFolderId && (
                <div style={{ padding: '14px 18px 0' }}>
                  {/* Folder section header with new folder button */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                      文件夹
                    </span>
                    {canUpload && (
                      <button onClick={() => { setShowCreateFolder(true); setNewFolderName('') }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 13px', background: 'transparent', border: '1.5px dashed #d97706', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#d97706', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = '#fffbeb'; el.style.borderStyle = 'solid' }}
                        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.borderStyle = 'dashed' }}>
                        <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                        新建文件夹
                      </button>
                    )}
                  </div>
                  {/* Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 110px)', gap: '2px 0', marginBottom: 18, justifyContent: 'start' }}>
                    {visibleFolders.map(folder => (
                      <div key={folder.id}
                        onDragEnter={e => { e.preventDefault(); setDragOverFolderId(folder.id) }}
                        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverFolderId(null) }}
                        onDrop={e => { e.preventDefault(); setDragOverFolderId(null); if (dragDocId) { moveDocToFolder(dragDocId, folder.id); setDragDocId(null) } }}
                        onClick={() => setCurrentFolderId(folder.id)}
                        style={{
                          background: dragOverFolderId === folder.id ? 'rgba(0,120,215,0.12)' : 'transparent',
                          border: `1px solid ${dragOverFolderId === folder.id ? 'rgba(0,120,215,0.5)' : 'transparent'}`,
                          borderRadius: 4, padding: '10px 6px 8px',
                          cursor: dragDocId ? 'copy' : 'pointer',
                          position: 'relative', transition: 'all 0.12s',
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          width: 110, boxSizing: 'border-box' as const,
                        }}
                        onMouseEnter={e => {
                          if (dragOverFolderId !== folder.id) {
                            const el = e.currentTarget as HTMLElement
                            el.style.background = 'rgba(0,120,215,0.08)'
                            el.style.borderColor = 'rgba(0,120,215,0.3)'
                          }
                        }}
                        onMouseLeave={e => {
                          if (dragOverFolderId !== folder.id) {
                            const el = e.currentTarget as HTMLElement
                            el.style.background = 'transparent'
                            el.style.borderColor = 'transparent'
                          }
                        }}>
                        {/* Delete button top-right */}
                        {isAdmin && (
                          <button
                            onClick={ev => { ev.stopPropagation(); deleteFolder(folder.id) }}
                            style={{ position: 'absolute', top: 7, right: 7, width: 20, height: 20, borderRadius: 5, border: 'none', background: 'transparent', color: '#cbd5e1', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fee2e2'; (e.currentTarget as HTMLElement).style.color = '#ef4444' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#cbd5e1' }}>
                            ×
                          </button>
                        )}
                        {/* Folder icon */}
                        <div style={{ width: 78, height: 64, marginBottom: 6, flexShrink: 0 }}>
                          <svg viewBox="0 0 78 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 2px 5px rgba(0,122,255,0.28))' }}>
                            <defs>
                              <linearGradient id={`fg-${folder.id}`} x1="39" y1="14" x2="39" y2="60" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#63B3FF"/>
                                <stop offset="100%" stopColor="#0A84FF"/>
                              </linearGradient>
                            </defs>
                            <path d="M5 21C5 18 7 16 10 16H27C30 16 32 17 34 19L37 21H5Z" fill="#3D9EF5"/>
                            <rect x="3" y="20" width="72" height="39" rx="7" fill={`url(#fg-${folder.id})`}/>
                            <rect x="3" y="20" width="72" height="13" rx="7" fill="rgba(255,255,255,0.22)"/>
                            <rect x="3" y="28" width="72" height="5" fill="rgba(255,255,255,0.08)"/>
                          </svg>
                        </div>
                        {/* Name */}
                        <p style={{ fontSize: 12, fontWeight: 400, color: '#0f172a', margin: '0 0 2px', lineHeight: 1.4, wordBreak: 'break-word', textAlign: 'center', width: '100%' }}>{folder.name}</p>
                        {/* Meta */}
                        <span style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                          {dragOverFolderId === folder.id ? '拖入此处' : `${folder.docIds.length} 个文件`}
                        </span>
                      </div>
                    ))}
                    {visibleFolders.length === 0 && filterSearch && (
                      <div style={{ gridColumn: '1/-1', padding: '12px 0', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>无匹配文件夹</div>
                    )}
                  </div>
                  {/* Files section label */}
                  {currentDocs.length > 0 || unfiledDocs.length > 0 ? (
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>文件</div>
                  ) : null}
                </div>
              )}

              {/* Empty state */}
              {currentDocs.length === 0 && !loadingDocs && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ color: '#475569', fontWeight: 500, fontSize: 13, margin: '0 0 4px' }}>{currentFolderId ? '文件夹为空' : '暂无文件'}</p>
                  <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>{canUpload ? '拖拽文件或点击上方区域上传' : '请联系管理员上传文档'}</p>
                </div>
              )}

              {/* Document rows */}
              {currentDocs.map((doc, i) => {
                const s = STATUS_MAP[doc.run] || STATUS_MAP.PENDING
                const fi = getFileIcon(doc.name)
                const isConf = doc.meta?.confidential
                const canDownload = !isConf || isAdmin || permissionLevel >= 1
                return (
                  <div key={doc.id}
                    draggable={!currentFolderId}
                    onDragStart={e => { if (!currentFolderId) { setDragDocId(doc.id); e.dataTransfer.effectAllowed = 'move' } }}
                    onDragEnd={() => setDragDocId(null)}
                    onClick={() => { if (!dragDocId) handlePreview(doc) }}
                    style={{ padding: '11px 18px', borderBottom: i < currentDocs.length - 1 ? '1px solid #e8edf5' : 'none',
                      opacity: dragDocId === doc.id ? 0.35 : 1, cursor: 'pointer',
                      background: dragDocId === doc.id ? '#f0fdf4' : 'transparent',
                      transition: 'all 0.18s' }}
                    onMouseEnter={e => { if (dragDocId !== doc.id) { (e.currentTarget as HTMLElement).style.background = 'rgba(239,246,255,0.85)'; (e.currentTarget as HTMLElement).style.transform = 'translateX(3px)' } }}
                    onMouseLeave={e => { if (dragDocId !== doc.id) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.transform = 'translateX(0)' } }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {/* Left: icon + name + meta */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        {!currentFolderId && (
                          <div style={{ color: '#d1d5db', flexShrink: 0 }} title="拖动到文件夹">
                            <svg style={{ width: 13, height: 13 }} fill="currentColor" viewBox="0 0 24 24"><path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zM8 16h2v2H8v-2zm6 0h2v2h-2v-2z"/></svg>
                          </div>
                        )}
                        <div style={{ width: 34, height: 34, background: fi.bg, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: fi.color }}>{fi.label}</span>
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button onClick={e => { e.stopPropagation(); handlePreview(doc) }}
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 300 }}>{doc.name}</span>
                            </button>
                            {isConf && (
                              <span title="机密文件" style={{ flexShrink: 0 }}>
                                <svg style={{ width: 12, height: 12, color: '#dc2626' }} fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM15.1 8H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>{fmtSize(doc.size)}{doc.create_date ? ` · ${doc.create_date.slice(0, 10)}` : ''}</span>
                            {doc.meta?.dept && <span style={{ fontSize: 12, fontWeight: 500, padding: '1px 6px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8' }}>{doc.meta.dept}</span>}
                            {doc.meta?.type && <span style={{ fontSize: 12, fontWeight: 500, padding: '1px 6px', borderRadius: 999, background: '#f3e8ff', color: '#7c3aed' }}>{doc.meta.type}</span>}
                            {isConf && <span style={{ fontSize: 12, fontWeight: 500, padding: '1px 6px', borderRadius: 999, background: '#fee2e2', color: '#dc2626' }}>机密</span>}
                            {doc.meta?.uploadedBy && <span style={{ fontSize: 12, fontWeight: 500, padding: '1px 6px', borderRadius: 999, background: '#dcfce7', color: '#16a34a' }}>↑ {doc.meta.uploadedBy}</span>}
                          </div>
                        </div>
                      </div>
                      {/* Right: status + actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, padding: '2px 7px', borderRadius: 999, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>
                        {currentFolderId && (
                          <button onClick={e => { e.stopPropagation(); removeDocFromFolder(doc.id, currentFolderId) }}
                            style={{ background: 'none', border: 'none', fontSize: 12, color: '#94a3b8', cursor: 'pointer', padding: '3px 6px', borderRadius: 5 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#d97706'; (e.currentTarget as HTMLElement).style.background = '#fffbeb' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                            移出
                          </button>
                        )}
                        {canDownload && (
                          <button onClick={e => { e.stopPropagation(); handleDownload(doc) }} title="下载"
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '3px', borderRadius: 5 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#2563eb' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}>
                            <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          </button>
                        )}
                        <button onClick={e => { e.stopPropagation(); toggleFav(doc) }}
                          style={{ background: favIds.has(doc.id) ? '#fffbeb' : 'none', border: `1.5px solid ${favIds.has(doc.id) ? '#fde68a' : '#e2e8f0'}`, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '3px 9px', borderRadius: 7, lineHeight: 1,
                            color: favIds.has(doc.id) ? '#f59e0b' : '#94a3b8', transition: 'background 0.12s, color 0.12s, border-color 0.12s', whiteSpace: 'nowrap' }}
                          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; if (!favIds.has(doc.id)) { el.style.color = '#f59e0b'; el.style.background = '#fffbeb'; el.style.borderColor = '#fde68a' } }}
                          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; if (!favIds.has(doc.id)) { el.style.color = '#94a3b8'; el.style.background = 'none'; el.style.borderColor = '#e2e8f0' } }}>
                          {favIds.has(doc.id) ? '已收藏' : '收藏'}
                        </button>
                        {canUpload && ['UNSTART', 'FAIL', 'CANCEL'].includes(doc.run) && (
                          <button onClick={e => { e.stopPropagation(); /* handleParse */ }} title="触发解析"
                            style={{ background: 'none', border: 'none', fontSize: 12, color: '#94a3b8', cursor: 'pointer', padding: '3px 6px', borderRadius: 5 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#d97706'; (e.currentTarget as HTMLElement).style.background = '#fffbeb' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                            解析
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={e => { e.stopPropagation(); handleSoftDelete(doc) }}
                            style={{ background: 'none', border: 'none', fontSize: 12, color: '#94a3b8', cursor: 'pointer', padding: '3px 6px', borderRadius: 5 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = '#fef2f2' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                            删除
                          </button>
                        )}
                      </div>
                    </div>
                    {/* AI summary */}
                    {doc.meta?.ai_summary && (
                      <div style={{ marginTop: 6, marginLeft: 86, padding: '6px 10px', background: '#f0fdf4', borderRadius: 7, border: '1px solid #bbf7d0' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', marginRight: 5 }}>AI摘要</span>
                        <span style={{ fontSize: 12, color: '#374151' }}>{doc.meta.ai_summary}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Preview Modal ── */}
      {previewDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '90%', maxWidth: 900, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 40px 80px rgba(0,0,0,0.3)', border: '1px solid #e2e8f0' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8edf5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, background: getFileIcon(previewDoc.name).bg, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: getFileIcon(previewDoc.name).color }}>{getFileIcon(previewDoc.name).label}</span>
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{previewDoc.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleDownload(previewDoc!)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 13, color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  下载
                </button>
                <button onClick={() => { setPreviewDoc(null); setPreviewContent('') }}
                  style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#f1f5f9', fontSize: 16, color: '#64748b', cursor: 'pointer' }}>×</button>
              </div>
            </div>
            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {previewLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10, color: '#64748b' }}>
                  <svg style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z" />
                  </svg>
                  加载中...
                </div>
              ) : (
                renderPreviewContent({ doc: previewDoc, content: previewContent, loading: false } as PreviewState, selectedDs!.id, previewDoc.name)
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Trash Modal ── */}
      {showTrash && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '90%', maxWidth: 700, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 40px 80px rgba(0,0,0,0.3)', border: '1px solid #e2e8f0' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8edf5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>回收站</h3>
              <button onClick={() => { setShowTrash(false); setTrashDocs([]) }}
                style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#f1f5f9', fontSize: 16, color: '#64748b', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {loadingTrash ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>加载中...</div>
              ) : trashDocs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>回收站为空</div>
              ) : (
                trashDocs.map(doc => {
                  const fi = getFileIcon(doc.name)
                  return (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ width: 32, height: 32, background: fi.bg, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: fi.color }}>{fi.label}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{fmtSize(doc.size)}{doc.create_date ? ` · ${doc.create_date.slice(0, 10)}` : ''}</div>
                      </div>
                      <button onClick={() => restoreFromTrash(doc.id)}
                        style={{ padding: '5px 12px', borderRadius: 7, border: '1.5px solid #bbf7d0', background: '#f0fdf4', fontSize: 12, color: '#16a34a', cursor: 'pointer' }}>
                        恢复
                      </button>
                      <button onClick={() => permanentlyDelete(doc.id)}
                        style={{ padding: '5px 12px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fef2f2', fontSize: 12, color: '#dc2626', cursor: 'pointer' }}>
                        永久删除
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create Folder Modal ── */}
      {showCreateFolder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e8edf5' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>新建文件夹</h3>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                placeholder="文件夹名称" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') createFolder() }}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e8edf5', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => { setShowCreateFolder(false); setNewFolderName('') }}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 13, color: '#64748b', cursor: 'pointer' }}>
                取消
              </button>
              <button onClick={createFolder} disabled={creatingFolder || !newFolderName.trim()}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: creatingFolder ? '#94a3b8' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: creatingFolder || !newFolderName.trim() ? 'not-allowed' : 'pointer' }}>
                {creatingFolder ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
