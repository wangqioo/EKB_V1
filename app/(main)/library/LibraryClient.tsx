'use client'
import { useState, useEffect, useRef } from 'react'

interface Dataset { id: string; name: string; description?: string; document_count?: number }
interface DocMeta { dept?: string; type?: string; confidential?: boolean; ai_summary?: string; deleted?: boolean; uploadedBy?: string }
interface Doc { id: string; name: string; size: number; run: string; create_date?: string; create_time?: number; meta?: DocMeta }
interface Folder { id: string; name: string; docIds: string[] }


// Module-level cache — persists across navigations in same browser session
const _dsCache: { data: { id: string; name: string; description?: string; document_count?: number }[] | null; ts: number } = { data: null, ts: 0 }
const _docsCache = new Map<string, { data: any[]; ts: number }>()
const _foldersCache = new Map<string, { data: { id: string; name: string; docIds: string[] }[]; ts: number }>()
const CACHE_TTL = 30_000

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  DONE:    { label: '已完成', color: 'var(--success)', bg: '#dcfce7' },
  RUNNING: { label: '解析中', color: 'var(--warning)', bg: '#fef9c3' },
  PENDING: { label: '待处理', color: 'var(--text-secondary)', bg: '#f1f5f9' },
  UNSTART: { label: '未开始', color: 'var(--text-secondary)', bg: '#f1f5f9' },
  FAIL:    { label: '失败',   color: 'var(--error)', bg: '#fee2e2' },
  CANCEL:  { label: '已取消', color: 'var(--text-secondary)', bg: '#f1f5f9' },
}

const DEPTS = ['行政部', '技术部', '市场部', '财务部', '人事部', '运营部', '法务部', '其他']
const DOC_TYPES = ['SOP', '合同', '政策', '培训资料', '会议纪要', '技术文档', '报告', '表格', '其他']

function fmtSize(b?: number) {
  if (!b) return '-'
  if (b < 1024) return `${b}B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)}KB`
  return `${(b / 1048576).toFixed(1)}MB`
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['pdf'].includes(ext)) return { bg: '#fee2e2', color: 'var(--error)', label: 'PDF' }
  if (['doc', 'docx'].includes(ext)) return { bg: '#dbeafe', color: 'var(--accent)', label: 'DOC' }
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { bg: '#dcfce7', color: 'var(--success)', label: 'XLS' }
  if (['ppt', 'pptx'].includes(ext)) return { bg: '#ffedd5', color: '#ea580c', label: 'PPT' }
  if (['md', 'txt'].includes(ext)) return { bg: '#f3e8ff', color: '#7c3aed', label: 'TXT' }
  return { bg: '#f1f5f9', color: 'var(--text-secondary)', label: ext.toUpperCase().slice(0, 3) || 'FILE' }
}

interface Props { userName: string; role: string; permissionLevel: number }

export default function LibraryClient({ userName, role, permissionLevel }: Props) {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDs, setSelectedDs] = useState<Dataset | null>(null)
  const [docs, setDocs] = useState<Doc[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)

  // Filter state
  const [filterDept, setFilterDept] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterUploader, setFilterUploader] = useState('')
  const [sortBy, setSortBy] = useState<'date'|'name'|'size'>('date')
  const [favIds, setFavIds] = useState(new Set() as Set<string>)

  // Upload modal state
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null)
  const [uploadDept, setUploadDept] = useState('')
  const [uploadType, setUploadType] = useState('')
  const [uploadConf, setUploadConf] = useState(false)
  const [uploadSummary, setUploadSummary] = useState('')
  const [uploading, setUploading] = useState(false)
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null)
  const [previewContent, setPreviewContent] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  // Trash modal state
  const [showTrash, setShowTrash] = useState(false)
  const [trashDocs, setTrashDocs] = useState<Doc[]>([])
  const [loadingTrash, setLoadingTrash] = useState(false)
  // GraphRAG state
  const [graphragRunning, setGraphragRunning] = useState(false)
  const [graphragProgress, setGraphragProgress] = useState(0)
  const [graphragMsg, setGraphragMsg] = useState('')
  const [graphragDone, setGraphragDone] = useState(false)
  const graphragTimerRef = useRef<ReturnType<typeof setInterval>>()
  const previewReqRef = useRef(0)


  // Create dataset / folder
  const [showCreate, setShowCreate] = useState(false)
  const [newDsName, setNewDsName] = useState('')
  const [newDsDesc, setNewDsDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [dragDocId, setDragDocId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)

  // Audio / WeChat
  const [showAudio, setShowAudio] = useState(false)
  const [audioTitle, setAudioTitle] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioResult, setAudioResult] = useState<{ ok: boolean; msg: string; preview?: string } | null>(null)
  const audioFileRef = useRef<HTMLInputElement>(null)
  const [showWechat, setShowWechat] = useState(false)
  const [wechatUrl, setWechatUrl] = useState('')
  const [wechatTitle, setWechatTitle] = useState('')
  const [wechatLoading, setWechatLoading] = useState(false)
  const [wechatResult, setWechatResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [wechatStep, setWechatStep] = useState(0)
  const wechatStepTimerRef = useRef<ReturnType<typeof setInterval>>()

  const [msg, setMsg] = useState('')

  const canUpload = role === 'admin' || permissionLevel >= 1
  const canCreate = role === 'admin' || permissionLevel >= 2
  const isAdmin = role === 'admin'

  // Clock
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t) }, [])

  useEffect(() => {
    if (_dsCache.data && Date.now() - _dsCache.ts < CACHE_TTL) {
      const list = _dsCache.data
      setDatasets(list)
      if (list.length > 0) { setSelectedDs(list[0]); loadDocs(list[0].id); loadFolders(list[0].id) }
      fetch('/api/datasets').then(r => r.json()).then(d => {
        _dsCache.data = d.data || []; _dsCache.ts = Date.now()
        setDatasets(_dsCache.data!)
      }).catch(() => {})
      return
    }
    fetch('/api/datasets').then(r => r.json()).then(d => {
      const list: Dataset[] = d.data || []
      _dsCache.data = list; _dsCache.ts = Date.now()
      setDatasets(list)
      if (list.length > 0) { setSelectedDs(list[0]); loadDocs(list[0].id); loadFolders(list[0].id) }
    })
  }, [])

  useEffect(() => {
    fetch('/api/favorites').then(r => r.json()).then(d => {
      const favDocs: string[] = (d.data || []).filter((f: any) => f.type === 'file').map((f: any) => f.docId as string)
      setFavIds(new Set(favDocs))
    }).catch(() => {})
  }, [])

  function loadDocs(dsId: string) {
    const cached = _docsCache.get(dsId)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      clearTimeout(loadingTimerRef.current)
      setDocs(cached.data)
      setLoadingDocs(false)
      fetch(`/api/datasets/docs?datasetId=${dsId}`).then(r => r.json()).then(d => {
        const docs = d.data || []
        _docsCache.set(dsId, { data: docs, ts: Date.now() })
        setDocs(docs)
      }).catch(() => {})
      return
    }
    clearTimeout(loadingTimerRef.current)
    loadingTimerRef.current = setTimeout(() => setLoadingDocs(true), 200)
    fetch(`/api/datasets/docs?datasetId=${dsId}`).then(r => r.json()).then(d => {
      clearTimeout(loadingTimerRef.current)
      const docs = d.data || []
      _docsCache.set(dsId, { data: docs, ts: Date.now() })
      setDocs(docs)
      setLoadingDocs(false)
    }).catch(() => { clearTimeout(loadingTimerRef.current); setLoadingDocs(false) })
  }

  async function loadFolders(dsId: string) {
    const cached = _foldersCache.get(dsId)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setFolders(cached.data)
      fetch(`/api/folders?datasetId=${dsId}`).then(r => r.json()).then(d => {
        const folders = d.folders || []
        _foldersCache.set(dsId, { data: folders, ts: Date.now() })
        setFolders(folders)
      }).catch(() => {})
      return
    }
    const r = await fetch(`/api/folders?datasetId=${dsId}`)
    const d = await r.json()
    const folders = d.folders || []
    _foldersCache.set(dsId, { data: folders, ts: Date.now() })
    setFolders(folders)
  }

  async function handleRunGraphRAG() {
    if (!selectedDs || graphragRunning) return
    setGraphragRunning(true)
    setGraphragProgress(0)
    setGraphragMsg('正在提交图整理任务...')
    setGraphragDone(false)
    const r = await fetch('/api/datasets/graphrag', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetId: selectedDs.id }),
    })
    const d = await r.json()
    if (d.code !== 0) {
      setGraphragMsg('启动失败: ' + (d.message || ''))
      setGraphragRunning(false)
      return
    }
    setGraphragMsg('图整理进行中，正在提取实体与关系...')
    graphragTimerRef.current = setInterval(async () => {
      try {
        const pr = await fetch('/api/datasets/graphrag?datasetId=' + selectedDs.id)
        const pd = await pr.json()
        const task = pd.data
        if (!task || Object.keys(task).length === 0) return
        const prog = typeof task.progress === 'number' ? task.progress : 0
        setGraphragProgress(Math.min(99, Math.round(prog * 100)))
        const msg = task.progress_msg || ''
        if (prog >= 1 || msg.includes('Task done')) {
          clearInterval(graphragTimerRef.current)
          setGraphragProgress(100)
          setGraphragMsg('文件图整理完成！知识图谱已构建。')
          setGraphragDone(true)
          setGraphragRunning(false)
        } else if (prog < 0 || msg.toLowerCase().includes('fail')) {
          clearInterval(graphragTimerRef.current)
          setGraphragMsg('图整理失败，请检查 RAGFlow 日志')
          setGraphragRunning(false)
        }
      } catch (e) { /* ignore */ }
    }, 3000)
  }

  async function loadTrash(dsId: string) {
    setLoadingTrash(true)
    const r = await fetch(`/api/datasets/docs?datasetId=${dsId}&showDeleted=true`)
    const d = await r.json()
    setTrashDocs(d.data || [])
    setLoadingTrash(false)
  }

  // Upload: intercept → open modal
  function handleFileDrop(files: FileList | null) {
    if (!files || files.length === 0) return
    setPendingFiles(files)
    setUploadDept(''); setUploadType(''); setUploadConf(false); setUploadSummary('')
  }

  async function confirmUpload() {
    if (!pendingFiles || !selectedDs) return
    setUploading(true); setMsg('')
    const uploadedIds: string[] = []
    for (const file of Array.from(pendingFiles)) {
      const form = new FormData()
      form.append('datasetId', selectedDs.id)
      form.append('file', file)
      form.append('dept', uploadDept)
      form.append('type', uploadType)
      form.append('confidential', String(uploadConf))
      form.append('ai_summary', uploadSummary)
      try {
        const r = await fetch('/api/datasets/upload', { method: 'POST', body: form })
        const data = await r.json()
        if (r.ok && data.data?.[0]?.id) uploadedIds.push(data.data[0].id)
      } catch {}
    }
    if (currentFolderId && uploadedIds.length > 0) {
      await fetch('/api/folders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId: selectedDs.id, folderId: currentFolderId, addDocIds: uploadedIds }),
      })
      await loadFolders(selectedDs.id)
    }
    setMsg(uploadedIds.length > 0 ? `✓ 上传成功 ${uploadedIds.length} 个文件` : '✗ 上传失败')
    if (fileRef.current) fileRef.current.value = ''
    setPendingFiles(null)
    setTimeout(() => loadDocs(selectedDs.id), 1500)
    setUploading(false)
  }

  function toggleFav(doc: Doc) {
    if (!selectedDs) return
    if (favIds.has(doc.id)) {
      setFavIds(prev => { const s = new Set(prev); s.delete(doc.id); return s })
      fetch('/api/favorites', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docId: doc.id }) }).catch(() => {})
    } else {
      setFavIds(prev => { const s = new Set(Array.from(prev)); s.add(doc.id); return s })
      fetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'file', docId: doc.id, docName: doc.name, datasetId: selectedDs.id, datasetName: selectedDs.name }) }).catch(() => {})
    }
  }

  async function handleSoftDelete(doc: Doc) {
    if (!confirm(`确认删除「${doc.name}」？可在回收站恢复。`)) return
    await fetch('/api/trash', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId: doc.id }),
    })
    setDocs(prev => prev.filter(d => d.id !== doc.id))
    setFolders(prev => prev.map(f => ({ ...f, docIds: f.docIds.filter(id => id !== doc.id) })))
    setMsg(`✓ 已移至回收站: ${doc.name}`)
  }

  async function handleRestore(doc: Doc) {
    await fetch('/api/trash', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId: doc.id }),
    })
    setTrashDocs(prev => prev.filter(d => d.id !== doc.id))
    loadDocs(selectedDs!.id)
  }

  async function handleHardDelete(doc: Doc) {
    if (!confirm(`永久删除「${doc.name}」？此操作无法撤销。`)) return
    await fetch('/api/trash', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetId: selectedDs!.id, docId: doc.id }),
    })
    setTrashDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  async function handlePreview(doc: Doc) {
    setPreviewDoc(doc); setPreviewContent(''); setPreviewLoading(true)
    const ext = doc.name.split('.').pop()?.toLowerCase() || ''
    if (ext === 'pdf') {
      setPreviewContent('__pdf__'); setPreviewLoading(false); return
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      setPreviewContent('__image__'); setPreviewLoading(false); return
    }
    const reqId = ++previewReqRef.current
    try {
      const r = await fetch(`/api/datasets/docs/download?datasetId=${selectedDs!.id}&docId=${doc.id}`)
      if (reqId !== previewReqRef.current) return
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        if (reqId !== previewReqRef.current) return
        setPreviewContent(`⚠️ ${d.error || '无法加载预览'}`)
        setPreviewLoading(false); return
      }
      if (['md', 'txt'].includes(ext)) {
        const text = await r.text()
        if (reqId !== previewReqRef.current) return
        setPreviewContent(text.slice(0, 30000))
      } else if (ext === 'csv') {
        const text = await r.text()
        if (reqId !== previewReqRef.current) return
        setPreviewContent('__csv__:' + text.slice(0, 60000))
      } else {
        setPreviewContent('__binary__')
      }
    } catch (e) { if (reqId === previewReqRef.current) setPreviewContent('加载失败，请尝试下载') }
    if (reqId === previewReqRef.current) setPreviewLoading(false)
  }

  function handleDownload(doc: Doc) {
    const url = `/api/datasets/docs/download?datasetId=${selectedDs!.id}&docId=${doc.id}`
    const a = document.createElement('a'); a.href = url; a.download = doc.name
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  async function handleParse(docId: string) {
    if (!selectedDs) return
    setMsg('正在触发解析...')
    const r = await fetch('/api/datasets/docs/parse', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetId: selectedDs.id, docIds: [docId] }),
    })
    if (r.ok) { setMsg('✓ 解析任务已提交'); setTimeout(() => loadDocs(selectedDs.id), 2000) }
    else { const d = await r.json(); setMsg('✗ 解析失败: ' + (d.error || '')) }
  }

  async function handleDeleteDataset(ds: Dataset) {
    if (!confirm(`确认删除知识库「${ds.name}」？`)) return
    const r = await fetch('/api/datasets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datasetId: ds.id }) })
    if (r.ok) {
      const newList = datasets.filter(d => d.id !== ds.id)
      setDatasets(newList)
      if (selectedDs?.id === ds.id) {
        const next = newList[0] || null; setSelectedDs(next); setCurrentFolderId(null)
        if (next) { loadDocs(next.id); loadFolders(next.id) } else { setDocs([]); setFolders([]) }
      }
    }
  }

  async function createDataset() {
    if (!newDsName.trim()) return
    setCreating(true)
    const r = await fetch('/api/datasets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newDsName.trim(), description: newDsDesc.trim() }) })
    const data = await r.json()
    setCreating(false)
    if (!r.ok) { setMsg('✗ ' + (data.error || '创建失败')); return }
    setShowCreate(false); setNewDsName(''); setNewDsDesc('')
    const dsRes = await fetch('/api/datasets')
    const dsData = await dsRes.json()
    const list: Dataset[] = dsData.data || []
    setDatasets(list)
    const created = list.find(d => d.name === newDsName.trim())
    if (created) { setSelectedDs(created); loadDocs(created.id); loadFolders(created.id) }
  }

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
    await loadFolders(selectedDs!.id)
  }

  async function removeDocFromFolder(docId: string, folderId: string) {
    await fetch('/api/folders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datasetId: selectedDs!.id, folderId, removeDocIds: [docId] }) })
    await loadFolders(selectedDs!.id)
  }

  async function handleAudioSubmit() {
    if (!audioFile || !selectedDs) return
    setAudioLoading(true); setAudioResult(null)
    const form = new FormData()
    form.append('kb_id', selectedDs.id); form.append('title', audioTitle.trim()); form.append('file', audioFile)
    try {
      const r = await fetch('/api/ingest/audio', { method: 'POST', body: form })
      const data = await r.json()
      if (data.ok) { setAudioResult({ ok: true, msg: `入库成功，共 ${data.char_count ?? '?'} 字`, preview: data.transcription }); setTimeout(() => loadDocs(selectedDs.id), 1500) }
      else setAudioResult({ ok: false, msg: data.error || '转写失败' })
    } catch { setAudioResult({ ok: false, msg: '网络错误' }) }
    setAudioLoading(false)
  }

  async function handleWechatSubmit() {
    if (!wechatUrl.trim() || !selectedDs) return
    setWechatLoading(true); setWechatResult(null); setWechatStep(0)
    clearInterval(wechatStepTimerRef.current)
    let step = 0
    wechatStepTimerRef.current = setInterval(() => {
      step = Math.min(step + 1, 2); setWechatStep(step)
    }, 4000)
    const dsId = selectedDs.id
    try {
      const r = await fetch('/api/ingest/wechat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: wechatUrl.trim(), kb_id: dsId, title_override: wechatTitle.trim() }) })
      const data = await r.json()
      clearInterval(wechatStepTimerRef.current)
      if (data.ok) {
        setWechatStep(3)
        if (data.summary && data.doc_id) {
          await fetch('/api/doc-meta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docId: data.doc_id, ai_summary: data.summary }) }).catch(() => {})
        }
        _docsCache.delete(dsId)
        const docId = data.doc_id
        setTimeout(async () => {
          const r2 = await fetch(`/api/datasets/docs?datasetId=${dsId}`)
          const d2 = await r2.json()
          const newDocs = d2.data || []
          _docsCache.set(dsId, { data: newDocs, ts: Date.now() })
          setDocs(newDocs)
          setWechatLoading(false)
          setWechatUrl(''); setWechatTitle('')
          setShowWechat(false)
          if (docId) {
            const newDoc = newDocs.find((d: Doc) => d.id === docId)
            if (newDoc) handlePreview(newDoc)
          }
        }, 800)
        return
      } else {
        setWechatResult({ ok: false, msg: data.error || '导入失败' })
      }
    } catch {
      clearInterval(wechatStepTimerRef.current)
      setWechatResult({ ok: false, msg: '网络错误' })
    }
    setWechatLoading(false)
  }

  // Computed
  const currentFolder = folders.find(f => f.id === currentFolderId) || null
  const allFiledDocIds = new Set(folders.flatMap(f => f.docIds))
  const unfiledDocs = docs.filter(d => !allFiledDocIds.has(d.id))
  let currentDocs = currentFolderId ? docs.filter(d => currentFolder?.docIds.includes(d.id)) : unfiledDocs

  // Apply filters
  if (filterDept) currentDocs = currentDocs.filter(d => d.meta?.dept === filterDept)
  if (filterType) currentDocs = currentDocs.filter(d => d.meta?.type === filterType)
  if (filterSearch) currentDocs = currentDocs.filter(d => d.name.toLowerCase().includes(filterSearch.toLowerCase()))
  if (filterUploader) currentDocs = currentDocs.filter(d => d.meta?.uploadedBy === filterUploader)

  // Filter folders by search (when in root view)
  const visibleFolders = (!currentFolderId && filterSearch)
    ? folders.filter(f => f.name.toLowerCase().includes(filterSearch.toLowerCase()))
    : folders
  currentDocs = [...currentDocs].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name, 'zh-CN')
    if (sortBy === 'size') return (b.size || 0) - (a.size || 0)
    return (b.create_time || 0) - (a.create_time || 0)
  })
  const uniqueUploaders = Array.from(new Set(docs.map(d => d.meta?.uploadedBy).filter((u): u is string => !!u)))

  const today = new Date().toISOString().slice(0, 10)
  const todayCount = docs.filter(d => d.create_date?.startsWith(today)).length

  // Date + time display
  const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })

  function renderPreviewContent(content: string, docName: string) {
    const ext = docName.split('.').pop()?.toLowerCase() || ''
    const dlUrl = `/api/datasets/docs/download?datasetId=${selectedDs!.id}&docId=${previewDoc!.id}`

    if (content === '__pdf__') {
      return <iframe src={dlUrl} style={{ width: '100%', height: '68vh', border: 'none', borderRadius: 6 }} title={docName} />
    }

    if (content === '__image__') {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px 0' }}>
          <img src={dlUrl} alt={docName} style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 6 }} />
        </div>
      )
    }

    if (content.startsWith('__csv__:')) {
      const rows = content.slice(8).split('\n').filter((r: string) => r.trim())
        .map((r: string) => r.split(',').map((c: string) => c.replace(/^"|"$/g, '').trim()))
      return (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <tbody>
              {rows.map((row: string[], i: number) => (
                <tr key={i} style={{ background: i === 0 ? '#f1f5f9' : i % 2 === 1 ? '#f9fafb' : 'var(--bg-surface)' }}>
                  {row.map((cell: string, j: number) => i === 0
                    ? <th key={j} style={{ padding: '8px 12px', border: '1px solid var(--border)', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'left', whiteSpace: 'nowrap' }}>{cell}</th>
                    : <td key={j} style={{ padding: '7px 12px', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>{cell}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (content === '__binary__') {
      return (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>此文件类型不支持在线预览</p>
          <button onClick={() => handleDownload(previewDoc!)}
            style={{ marginTop: 12, padding: '9px 20px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: 'var(--bg-surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            下载文件
          </button>
        </div>
      )
    }

    if (ext === 'md') {
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
            if (end !== -1) { result.push(<code key={k++} style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontSize: '0.88em', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{text.slice(i + 1, end)}</code>); i = end + 1; continue }
          }
          if (text[i] === '!' && text[i + 1] === '[') {
            const be = text.indexOf(']', i + 2)
            if (be !== -1 && text[be + 1] === '(') {
              const pe = text.indexOf(')', be + 2)
              if (pe !== -1) { result.push(<img key={k++} src={text.slice(be + 2, pe)} alt={text.slice(i + 2, be)} style={{ maxWidth: '100%', borderRadius: 6, margin: '4px 0', verticalAlign: 'middle', display: 'block' }} />); i = pe + 1; continue }
            }
          }
          if (text[i] === '[') {
            const be = text.indexOf(']', i)
            if (be !== -1 && text[be + 1] === '(') {
              const pe = text.indexOf(')', be + 2)
              if (pe !== -1) { result.push(<a key={k++} href={text.slice(be + 2, pe)} target='_blank' rel='noopener noreferrer' style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{text.slice(i + 1, be)}</a>); i = pe + 1; continue }
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
          els.push(<pre key={li} style={{ background: 'var(--text-primary)', color: '#e2e8f0', padding: '14px 16px', borderRadius: 10, fontSize: 12.5, overflowX: 'auto', margin: '12px 0', lineHeight: 1.65, fontFamily: 'monospace' }}>{codeLines.join('\n')}</pre>)
          li++; continue
        }
        const h1m = line.match(/^# (.+)/); if (h1m) { els.push(<h1 key={li} style={{ fontSize: 22, fontWeight: 800, margin: '28px 0 14px', color: 'var(--text-primary)', borderBottom: '2px solid #e2e8f0', paddingBottom: 10, letterSpacing: '-0.01em' }}>{inlineMd(h1m[1])}</h1>); li++; continue }
        const h2m = line.match(/^## (.+)/); if (h2m) { els.push(<h2 key={li} style={{ fontSize: 17, fontWeight: 700, margin: '20px 0 10px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: 5 }}>{inlineMd(h2m[1])}</h2>); li++; continue }
        const h3m = line.match(/^### (.+)/); if (h3m) { els.push(<h3 key={li} style={{ fontSize: 15, fontWeight: 700, margin: '16px 0 8px', color: 'var(--text-primary)' }}>{inlineMd(h3m[1])}</h3>); li++; continue }
        const h4m = line.match(/^#### (.+)/); if (h4m) { els.push(<h4 key={li} style={{ fontSize: 14, fontWeight: 700, margin: '14px 0 7px', color: 'var(--text-primary)' }}>{inlineMd(h4m[1])}</h4>); li++; continue }
        if (line.match(/^(-{3,}|_{3,}|\*{3,})$/)) { els.push(<hr key={li} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />); li++; continue }
        if (line.startsWith('> ')) { els.push(<blockquote key={li} style={{ margin: '10px 0', padding: '8px 14px', background: 'var(--bg-elevated)', borderLeft: '3px solid #cbd5e1', color: 'var(--text-secondary)', fontSize: 13, borderRadius: '0 6px 6px 0' }}>{inlineMd(line.slice(2))}</blockquote>); li++; continue }
        if (line.match(/^[*\-+] /)) {
          const items: string[] = []
          while (li < lines.length && lines[li].match(/^[*\-+] /)) { items.push(lines[li].slice(2)); li++ }
          els.push(<ul key={li} style={{ margin: '8px 0', paddingLeft: 22 }}>{items.map((it, j) => <li key={j} style={{ fontSize: 13.5, color: 'var(--text-primary)', margin: '3px 0', lineHeight: 1.65 }}>{inlineMd(it)}</li>)}</ul>)
          continue
        }
        if (line.match(/^\d+\. /)) {
          const items: string[] = []
          while (li < lines.length && lines[li].match(/^\d+\. /)) { items.push(lines[li].replace(/^\d+\. /, '')); li++ }
          els.push(<ol key={li} style={{ margin: '8px 0', paddingLeft: 22 }}>{items.map((it, j) => <li key={j} style={{ fontSize: 13.5, color: 'var(--text-primary)', margin: '3px 0', lineHeight: 1.65 }}>{inlineMd(it)}</li>)}</ol>)
          continue
        }
        const imgLine = line.match(/^!\[([^\]]*)\]\((.+)\)$/)
        if (imgLine) { els.push(<div key={li} style={{ textAlign: 'center', margin: '16px 0' }}><img src={imgLine[2]} alt={imgLine[1]} style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.10)', display: 'inline-block' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} /></div>); li++; continue }
        if (line.trim().startsWith('<span') && line.includes('</span>')) { els.push(<span key={li} dangerouslySetInnerHTML={{ __html: line.trim() }} />); li++; continue }
        if (line.trim() === '') { els.push(<div key={li} style={{ height: 6 }} />); li++; continue }
        els.push(<p key={li} style={{ fontSize: 14.5, color: 'var(--text-primary)', margin: '8px 0', lineHeight: 1.9, letterSpacing: '0.01em' }}>{inlineMd(line)}</p>)
        li++
      }
      return <div style={{ lineHeight: 1.85, maxWidth: 720, margin: '0 auto', fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif' }}>{els}</div>
    }

    return <pre style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.7, margin: 0 }}>{content}</pre>
  }

  return (
    <>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ padding: '16px 28px 0', background: 'rgba(255,255,255,.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {/* Title row + action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>知识库</h1>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '3px 0 0' }}>管理企业知识文档{todayCount > 0 ? ` · 今日新增 ${todayCount} 份文件` : ''}</p>
            </div>
            {(canCreate || isAdmin) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {canUpload && selectedDs && (
                  <button onClick={handleRunGraphRAG} disabled={graphragRunning}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                      background: graphragRunning ? '#f97316' : 'var(--bg-surface)',
                      border: `1.5px solid ${graphragRunning ? '#ea580c' : '#e2e8f0'}`,
                      borderRadius: 10, fontSize: 13, fontWeight: 600,
                      color: graphragRunning ? '#fff' : '#ea580c',
                      cursor: graphragRunning ? 'not-allowed' : 'pointer',
                      transition: 'all 0.18s', opacity: graphragRunning ? 0.8 : 1,
                      boxShadow: graphragRunning ? '0 2px 8px rgba(249,115,22,.25)' : 'none' }}
                    onMouseEnter={e => { if (!graphragRunning) { (e.currentTarget as HTMLElement).style.background = '#fff7ed'; (e.currentTarget as HTMLElement).style.borderColor = '#ea580c' } }}
                    onMouseLeave={e => { if (!graphragRunning) { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0' } }}>
                    <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    {graphragRunning ? '整理中...' : '文件深度整理'}
                  </button>
                )}
                {canCreate && (
                  <button onClick={() => setShowCreate(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      color: 'var(--bg-surface)', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,.35)', transition: 'all 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(99,102,241,.45)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(99,102,241,.35)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}>
                    <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    新建知识库
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Dataset tabs */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {datasets.map(ds => (
              <div key={ds.id} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => { setSelectedDs(ds); setCurrentFolderId(null); setFilterDept(''); setFilterType(''); setFilterSearch(''); setFilterUploader(''); loadDocs(ds.id); loadFolders(ds.id) }}
                  style={{
                    padding: '9px 18px', border: 'none', fontSize: 13, fontWeight: selectedDs?.id === ds.id ? 700 : 500,
                    cursor: 'pointer', background: 'none', transition: 'all 0.15s',
                    color: selectedDs?.id === ds.id ? '#2563eb' : 'var(--text-secondary)',
                    borderBottom: `2.5px solid ${selectedDs?.id === ds.id ? '#2563eb' : 'transparent'}`,
                    marginBottom: -1,
                  }}
                  onMouseEnter={e => { if (selectedDs?.id !== ds.id) (e.currentTarget as HTMLElement).style.color = '#374151' }}
                  onMouseLeave={e => { if (selectedDs?.id !== ds.id) (e.currentTarget as HTMLElement).style.color = '#64748b' }}>
                  {ds.name}
                  <span style={{ marginLeft: 5, fontSize: 12, opacity: 0.6,
                    background: selectedDs?.id === ds.id ? '#eff6ff' : '#f1f5f9',
                    color: selectedDs?.id === ds.id ? '#2563eb' : 'var(--text-tertiary)',
                    padding: '1px 6px', borderRadius: 1099, fontWeight: 500 }}>
                    {ds.document_count ?? docs.length}
                  </span>
                </button>
                {isAdmin && (
                  <button onClick={() => handleDeleteDataset(ds)} title="删除此知识库"
                    style={{ position: 'absolute', top: 2, right: -2, width: 14, height: 14, borderRadius: '50%', background: '#ef4444', border: 'none', color: 'var(--bg-surface)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0'}>×</button>
                )}
              </div>
            ))}
            {datasets.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', paddingBottom: 10 }}>暂无知识库</span>}
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 28px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Upload zone */}
          {canUpload && selectedDs && (
            <div
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); handleFileDrop(e.dataTransfer.files) }}
              onClick={() => fileRef.current?.click()}
              style={{ border: `1.5px dashed ${drag ? '#3b82f6' : '#c7d8f8'}`, borderRadius: 14, padding: '20px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer',
                background: drag ? '#eff6ff' : '#ffffff', transition: 'all 0.2s', flexShrink: 0,
                boxShadow: drag ? '0 0 0 3px rgba(59,130,246,.15)' : '0 1px 4px rgba(0,0,0,.06)' }}>
              <svg style={{ width: 22, height: 22, color: drag ? '#3b82f6' : 'var(--accent)', marginBottom: 2 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p style={{ fontSize: 13, fontWeight: 500, color: drag ? '#3b82f6' : 'var(--text-secondary)', margin: 0 }}>
                {drag ? '松开上传' : currentFolderId ? `拖拽上传至「${currentFolder?.name}」` : <span>拖拽文件到此处上传，或 <span style={{ color: '#6366f1', fontWeight: 600 }}>点击选择文件</span></span>}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>PDF · Word · Excel · PPT · TXT · Markdown</p>
            </div>
          )}
          <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.pptx,.ppt"
            onChange={e => handleFileDrop(e.target.files)} />

          {/* Action buttons row */}
          {selectedDs && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0, alignItems: 'center' }}>
              {canUpload && (
                <>
                  <button onClick={() => { setShowAudio(true); setAudioResult(null); setAudioFile(null); setAudioTitle('') }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 10, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#a78bfa'; (e.currentTarget as HTMLElement).style.color = '#7c3aed' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLElement).style.color = '#374151' }}>
                    <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    音频录入
                  </button>
                  <button onClick={() => { setShowWechat(true); setWechatResult(null); setWechatUrl(''); setWechatTitle('') }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 10, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#86efac'; (e.currentTarget as HTMLElement).style.color = '#16a34a' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLElement).style.color = '#374151' }}>
                    <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    媒体导入
                  </button>
                </>
              )}
              {isAdmin && (
                <button onClick={() => { setShowTrash(true); loadTrash(selectedDs.id) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 10, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#fca5a5'; (e.currentTarget as HTMLElement).style.color = '#dc2626' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLElement).style.color = '#374151' }}>
                  <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  回收站
                </button>
              )}
            </div>
          )}

          {/* Unified filter bar */}
          {selectedDs && (
            <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <svg style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--text-tertiary)', pointerEvents: 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
                <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="搜索文件名..."
                  style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: 8, border: `1.5px solid ${filterSearch ? '#3b82f6' : '#e2e8f0'}`, fontSize: 13, color: 'var(--text-primary)', outline: 'none', width: 160, background: filterSearch ? '#eff6ff' : 'var(--bg-elevated)', transition: 'border-color 0.15s' }} />
              </div>
              <div style={{ width: 1, height: 20, background: '#e2e8f0', flexShrink: 0 }} />
              {uniqueUploaders.length > 0 && (
                <select value={filterUploader} onChange={e => setFilterUploader(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${filterUploader ? '#3b82f6' : '#e2e8f0'}`, fontSize: 12, background: filterUploader ? '#eff6ff' : 'var(--bg-elevated)', color: filterUploader ? '#2563eb' : 'var(--text-secondary)', outline: 'none', cursor: 'pointer' }}>
                  <option value=''>全部上传者</option>
                  {uniqueUploaders.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              )}
              <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${filterDept ? '#3b82f6' : '#e2e8f0'}`, fontSize: 12, background: filterDept ? '#eff6ff' : 'var(--bg-elevated)', color: filterDept ? '#2563eb' : 'var(--text-secondary)', outline: 'none', cursor: 'pointer' }}>
                <option value=''>全部部门</option>
                {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${filterType ? '#3b82f6' : '#e2e8f0'}`, fontSize: 12, background: filterType ? '#eff6ff' : 'var(--bg-elevated)', color: filterType ? '#2563eb' : 'var(--text-secondary)', outline: 'none', cursor: 'pointer' }}>
                <option value=''>全部类型</option>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <div style={{ width: 1, height: 20, background: '#e2e8f0', flexShrink: 0 }} />
              <select value={sortBy} onChange={e => setSortBy(e.target.value as 'date'|'name'|'size')}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-strong)', fontSize: 12, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', outline: 'none', cursor: 'pointer' }}>
                <option value='date'>最新优先</option>
                <option value='name'>名称排序</option>
                <option value='size'>大小排序</option>
              </select>
              {(filterSearch || filterUploader || filterDept || filterType) && (
                <button onClick={() => { setFilterSearch(''); setFilterUploader(''); setFilterDept(''); setFilterType('') }}
                  style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#ef4444', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  清除筛选
                </button>
              )}
            </div>
          )}

          {msg && <div style={{ fontSize: 13, color: msg.startsWith('✓') ? '#16a34a' : 'var(--error)', flexShrink: 0 }}>{msg}</div>}

          {/* File list */}
          {!selectedDs ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>{canCreate ? '请先创建或选择一个知识库' : '暂无可用知识库，请联系管理员'}</div>
          ) : (
            <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, opacity: loadingDocs ? 0.45 : 1, transition: 'opacity 0.18s', pointerEvents: loadingDocs ? 'none' : 'auto' }}>
              {/* List header */}
              <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  {currentFolderId ? (
                    <>
                      <button onClick={() => setCurrentFolderId(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 500, fontSize: 13, padding: 0 }}>
                        {selectedDs.name}
                      </button>
                      <span style={{ color: 'var(--text-tertiary)' }}>›</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{currentFolder?.name}</span>
                    </>
                  ) : (
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{selectedDs.name}</span>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4 }}>
                    {currentFolderId ? `${currentDocs.length} 个文件` : `${visibleFolders.length} 个文件夹 · ${currentDocs.length} 个文件`}
                  </span>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {/* Folder card grid */}
                {!currentFolderId && (
                  <div style={{ padding: '14px 18px 0' }}>
                    {/* Folder section header with new folder button */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                        文件夹
                      </span>
                      <button onClick={() => { setShowCreateFolder(true); setNewFolderName('') }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 13px', background: 'transparent', border: '1.5px dashed #d97706', borderRadius: 10, fontSize: 12, fontWeight: 600, color: 'var(--warning)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = '#fffbeb'; el.style.borderStyle = 'solid' }}
                        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.borderStyle = 'dashed' }}>
                        <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                        新建文件夹
                      </button>
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
                          <p style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 2px', lineHeight: 1.4, wordBreak: 'break-word', textAlign: 'center', width: '100%' }}>{folder.name}</p>
                          {/* Meta */}
                          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                            {dragOverFolderId === folder.id ? '拖入此处' : `${folder.docIds.length} 个文件`}
                          </span>
                        </div>
                      ))}
                      {visibleFolders.length === 0 && filterSearch && (
                        <div style={{ gridColumn: '1/-1', padding: '12px 0', fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>无匹配文件夹</div>
                      )}
                    </div>
                    {/* Files section label */}
                    {currentDocs.length > 0 || unfiledDocs.length > 0 ? (
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>文件</div>
                    ) : null}
                  </div>
                )}

                {/* Empty state */}
                {currentDocs.length === 0 && !loadingDocs && (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <p style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: 13, margin: '0 0 4px' }}>{currentFolderId ? '文件夹为空' : '暂无文件'}</p>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 12, margin: 0 }}>{canUpload ? '拖拽文件或点击上方区域上传' : '请联系管理员上传文档'}</p>
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
                          <div style={{ width: 34, height: 34, background: fi.bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: fi.color }}>{fi.label}</span>
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button onClick={e => { e.stopPropagation(); handlePreview(doc) }}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 300 }}>{doc.name}</span>
                              </button>
                              {isConf && (
                                <span title="机密文件" style={{ flexShrink: 0 }}>
                                  <svg style={{ width: 12, height: 12, color: 'var(--error)' }} fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM15.1 8H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fmtSize(doc.size)}{doc.create_date ? ` · ${doc.create_date.slice(0, 10)}` : ''}</span>
                              {doc.meta?.dept && <span style={{ fontSize: 12, fontWeight: 500, padding: '1px 6px', borderRadius: 1099, background: '#dbeafe', color: '#1d4ed8' }}>{doc.meta.dept}</span>}
                              {doc.meta?.type && <span style={{ fontSize: 12, fontWeight: 500, padding: '1px 6px', borderRadius: 1099, background: '#f3e8ff', color: '#7c3aed' }}>{doc.meta.type}</span>}
                              {isConf && <span style={{ fontSize: 12, fontWeight: 500, padding: '1px 6px', borderRadius: 1099, background: '#fee2e2', color: 'var(--error)' }}>机密</span>}
                              {doc.meta?.uploadedBy && <span style={{ fontSize: 12, fontWeight: 500, padding: '1px 6px', borderRadius: 1099, background: '#dcfce7', color: 'var(--success)' }}>↑ {doc.meta.uploadedBy}</span>}
                            </div>
                          </div>
                        </div>
                        {/* Right: status + actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, padding: '2px 7px', borderRadius: 1099, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>
                          {currentFolderId && (
                            <button onClick={e => { e.stopPropagation(); removeDocFromFolder(doc.id, currentFolderId) }}
                              style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer', padding: '3px 6px', borderRadius: 5 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#d97706'; (e.currentTarget as HTMLElement).style.background = '#fffbeb' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                              移出
                            </button>
                          )}
                          {canDownload && (
                            <button onClick={e => { e.stopPropagation(); handleDownload(doc) }} title="下载"
                              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '3px', borderRadius: 5 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#2563eb' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}>
                              <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); toggleFav(doc) }}
                            style={{ background: favIds.has(doc.id) ? '#fffbeb' : 'none', border: `1.5px solid ${favIds.has(doc.id) ? '#fde68a' : '#e2e8f0'}`, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '3px 9px', borderRadius: 8, lineHeight: 1,
                              color: favIds.has(doc.id) ? '#f59e0b' : 'var(--text-tertiary)', transition: 'background 0.12s, color 0.12s, border-color 0.12s', whiteSpace: 'nowrap' }}
                            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; if (!favIds.has(doc.id)) { el.style.color = '#f59e0b'; el.style.background = '#fffbeb'; el.style.borderColor = '#fde68a' } }}
                            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; if (!favIds.has(doc.id)) { el.style.color = '#94a3b8'; el.style.background = 'none'; el.style.borderColor = '#e2e8f0' } }}>
                            {favIds.has(doc.id) ? '已收藏' : '收藏'}
                          </button>
                          {canUpload && ['UNSTART', 'FAIL', 'CANCEL'].includes(doc.run) && (
                            <button onClick={e => { e.stopPropagation(); handleParse(doc.id) }} title="触发解析"
                              style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer', padding: '3px 6px', borderRadius: 5 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#d97706'; (e.currentTarget as HTMLElement).style.background = '#fffbeb' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                              解析
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={e => { e.stopPropagation(); handleSoftDelete(doc) }}
                              style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer', padding: '3px 6px', borderRadius: 5 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = '#fef2f2' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                              删除
                            </button>
                          )}
                        </div>
                      </div>
                      {/* AI summary */}
                      {doc.meta?.ai_summary && (
                        <div style={{ marginTop: 6, marginLeft: 86, padding: '5px 10px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>📌</span>
                          <span style={{ fontSize: 12, color: '#1d4ed8', lineHeight: 1.55 }}>{doc.meta.ai_summary}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* GraphRAG Progress Overlay */}
      {(graphragRunning || graphragDone) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}>
          <div style={{ background: 'var(--text-primary)', borderRadius: 20, padding: '40px 48px', width: '100%', maxWidth: 500, boxShadow: '0 40px 80px rgba(0,0,0,0.6)', border: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {graphragDone
                  ? <svg style={{ width: 22, height: 22, color: '#22c55e' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  : <svg style={{ width: 22, height: 22, color: '#818cf8' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                }
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>文件深度整理</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>GraphRAG · 知识图谱构建 · {selectedDs?.name}</div>
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>整理进度</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: graphragDone ? '#22c55e' : '#818cf8', fontVariantNumeric: 'tabular-nums' }}>{graphragProgress}%</span>
              </div>
              <div style={{ height: 10, background: 'var(--text-primary)', borderRadius: 1099, overflow: 'hidden', border: '1px solid #1e293b' }}>
                <div style={{ height: '100%', borderRadius: 1099, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                  width: graphragProgress + '%',
                  background: graphragDone ? 'linear-gradient(90deg,#16a34a,#22c55e)' : 'linear-gradient(90deg,#4338ca,#6366f1,#818cf8)',
                  boxShadow: graphragDone ? '0 0 16px rgba(34,197,94,0.45)' : '0 0 16px rgba(129,140,248,0.6)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
              {[
                { label: '提交整理任务', thresh: 1 },
                { label: '提取实体与关系', thresh: 25 },
                { label: '构建知识图谱', thresh: 55 },
                { label: '社区聚类与索引', thresh: 80 },
                { label: '图整理完成', thresh: 100 },
              ].map((step, i) => {
                const done = graphragProgress >= step.thresh
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: done ? '#22c55e' : 'var(--text-primary)',
                      border: '2px solid ' + (done ? '#22c55e' : '#334155'),
                      transition: 'all 0.5s ease' }}>
                      {done && <svg style={{ width: 11, height: 11 }} fill="none" viewBox="0 0 24 24" stroke="white"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span style={{ fontSize: 13, color: done ? '#e2e8f0' : '#334155', transition: 'color 0.5s', fontWeight: done ? 500 : 400 }}>{step.label}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ padding: '12px 16px', background: 'var(--text-primary)', borderRadius: 12, border: '1px solid ' + (graphragDone ? '#166534' : '#334155'), marginBottom: graphragDone ? 16 : 0 }}>
              <p style={{ fontSize: 12, color: graphragDone ? '#22c55e' : 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{graphragMsg || '...'}</p>
            </div>
            {graphragDone && (
              <button onClick={() => { setGraphragDone(false); setGraphragProgress(0); setGraphragMsg('') }}
                style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: 'var(--bg-surface)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}>
                完成
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upload modal with metadata */}
      {pendingFiles && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 50px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>上传文件信息</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
              共 {pendingFiles.length} 个文件：{Array.from(pendingFiles).map(f => f.name).join('、').slice(0, 60)}{pendingFiles.length > 1 ? '...' : ''}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>所属部门</label>
                <select value={uploadDept} onChange={e => setUploadDept(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', background: 'var(--bg-surface)', boxSizing: 'border-box' }}>
                  <option value=''>请选择部门（可选）</option>
                  {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>文件类型</label>
                <select value={uploadType} onChange={e => setUploadType(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', background: 'var(--bg-surface)', boxSizing: 'border-box' }}>
                  <option value=''>请选择类型（可选）</option>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>文件摘要（可选）</label>
                <textarea value={uploadSummary} onChange={e => setUploadSummary(e.target.value)} rows={2} placeholder="一句话描述文件内容..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', padding: '10px 14px', background: uploadConf ? '#fff5f5' : 'var(--bg-elevated)', border: `1.5px solid ${uploadConf ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 10 }}>
                <input type="checkbox" checked={uploadConf} onChange={e => setUploadConf(e.target.checked)} style={{ accentColor: 'var(--error)', width: 16, height: 16 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: uploadConf ? '#dc2626' : 'var(--text-primary)' }}>标记为机密文件</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>机密文件仅中级及以上权限用户可下载</div>
                </div>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={() => { setPendingFiles(null); if (fileRef.current) fileRef.current.value = '' }}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>取消</button>
              <button onClick={confirmUpload} disabled={uploading}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: uploading ? '#93c5fd' : 'var(--accent)', color: 'var(--bg-surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {uploading ? '上传中...' : '确认上传'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, width: '100%', maxWidth: 760, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{previewDoc.name}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  {previewDoc.meta?.dept && <span style={{ fontSize: 12, padding: '1px 7px', borderRadius: 1099, background: '#dbeafe', color: '#1d4ed8', fontWeight: 500 }}>{previewDoc.meta.dept}</span>}
                  {previewDoc.meta?.type && <span style={{ fontSize: 12, padding: '1px 7px', borderRadius: 1099, background: '#f3e8ff', color: '#7c3aed', fontWeight: 500 }}>{previewDoc.meta.type}</span>}
                  {previewDoc.meta?.confidential && <span style={{ fontSize: 12, padding: '1px 7px', borderRadius: 1099, background: '#fee2e2', color: 'var(--error)', fontWeight: 500 }}>机密</span>}
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fmtSize(previewDoc.size)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleDownload(previewDoc)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  下载
                </button>
                <button onClick={() => { setPreviewDoc(null); setPreviewContent(''); setPreviewLoading(false) }}
                  style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}>×</button>
              </div>
            </div>
            {previewDoc.meta?.ai_summary && (
              <div style={{ padding: '10px 24px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)', marginRight: 6 }}>AI摘要</span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{previewDoc.meta.ai_summary}</span>
              </div>
            )}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
              {previewLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>加载预览中...</div>
              ) : renderPreviewContent(previewContent, previewDoc.name)}
            </div>
          </div>
        </div>
      )}

      {/* Trash modal */}
      {showTrash && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>回收站</h2>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '3px 0 0' }}>已软删除的文件，可恢复或永久删除</p>
              </div>
              <button onClick={() => setShowTrash(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text-tertiary)', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 24px' }}>
              {loadingTrash ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>加载中...</div>
              ) : trashDocs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>🗑️</div>
                  <p style={{ fontSize: 13 }}>回收站为空</p>
                </div>
              ) : trashDocs.map((doc, i) => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < trashDocs.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{doc.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
                      {fmtSize(doc.size)} · 删除于 {(doc.meta as { deleted_at?: string })?.deleted_at?.slice(0, 10) || '—'} by {(doc.meta as { deleted_by?: string })?.deleted_by || '—'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleRestore(doc)}
                      style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #86efac', background: '#f0fdf4', color: 'var(--success)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                      恢复
                    </button>
                    <button onClick={() => handleHardDelete(doc)}
                      style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #fca5a5', background: '#fef2f2', color: 'var(--error)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                      永久删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create dataset modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 50px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 20px' }}>新建知识库</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>名称 *</label>
                <input value={newDsName} onChange={e => setNewDsName(e.target.value)} placeholder="知识库名称" autoFocus
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>描述（可选）</label>
                <textarea value={newDsDesc} onChange={e => setNewDsDesc(e.target.value)} rows={2}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={() => { setShowCreate(false); setNewDsName(''); setNewDsDesc('') }} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>取消</button>
              <button onClick={createDataset} disabled={creating || !newDsName.trim()} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: creating || !newDsName.trim() ? '#93c5fd' : 'var(--accent)', color: 'var(--bg-surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {creating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create folder modal */}
      {showCreateFolder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 380, boxShadow: '0 20px 50px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--warning-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ width: 16, height: 16, color: 'var(--warning)' }} fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/></svg>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>在「{selectedDs?.name}」中新建文件夹</h3>
            </div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>文件夹名称</label>
            <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createFolder()} placeholder="例如：合同文件、政策资料" autoFocus
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setShowCreateFolder(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>取消</button>
              <button onClick={createFolder} disabled={creatingFolder || !newFolderName.trim()} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: creatingFolder || !newFolderName.trim() ? '#fde68a' : 'var(--warning)', color: 'var(--bg-surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {creatingFolder ? '创建中...' : '创建文件夹'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audio modal */}
      {showAudio && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 20px 50px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ width: 17, height: 17, color: '#7c3aed' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>会议纪要音频录入</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 5 }}>会议标题（可选）</label>
                <input value={audioTitle} onChange={e => setAudioTitle(e.target.value)} placeholder="留空则使用文件名" style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 5 }}>录音文件 *</label>
                <div onClick={() => audioFileRef.current?.click()} style={{ border: '1.5px dashed #d1d5db', borderRadius: 10, padding: '12px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-elevated)' }}>
                  {audioFile ? <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{audioFile.name} ({fmtSize(audioFile.size)})</span> : <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>点击选择录音文件（WAV/MP3/M4A/OGG）</span>}
                </div>
                <input ref={audioFileRef} type="file" style={{ display: 'none' }} accept=".wav,.mp3,.m4a,.ogg,.flac,.aac,.webm" onChange={e => { if (e.target.files?.[0]) setAudioFile(e.target.files[0]) }} />
              </div>
            </div>
            {audioResult && (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: audioResult.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${audioResult.ok ? '#86efac' : '#fca5a5'}` }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: audioResult.ok ? '#16a34a' : 'var(--error)' }}>{audioResult.msg}</div>
                {audioResult.preview && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, maxHeight: 70, overflow: 'hidden' }}>{audioResult.preview}...</div>}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAudio(false)} style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>关闭</button>
              <button onClick={handleAudioSubmit} disabled={audioLoading || !audioFile} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: audioLoading || !audioFile ? '#c4b5fd' : '#7c3aed', color: 'var(--bg-surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {audioLoading ? '转写入库中...' : '开始转写入库'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WeChat modal */}
      {showWechat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 20px 50px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ width: 17, height: 17, color: 'var(--success)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>媒体信息导入</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 5 }}>文章链接 *</label>
                <input value={wechatUrl} onChange={e => setWechatUrl(e.target.value)} placeholder="https://mp.weixin.qq.com/s/..." autoFocus style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 5 }}>自定义标题（可选）</label>
                <input value={wechatTitle} onChange={e => setWechatTitle(e.target.value)} placeholder="留空则使用原标题" style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            {wechatLoading && (
              <div style={{ marginTop: 14, padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
                {([
                  { icon: '🔍', label: '正在抓取公众号文章...' },
                  { icon: '🤖', label: '正在生成 AI 摘要...' },
                  { icon: '📥', label: '正在上传到知识库...' },
                ] as const).map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', opacity: wechatStep >= i ? 1 : 0.25, transition: 'opacity 0.5s ease' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                      background: wechatStep > i ? '#dcfce7' : wechatStep === i ? '#dbeafe' : '#f1f5f9',
                      boxShadow: wechatStep === i ? '0 0 0 3px #bfdbfe' : 'none', transition: 'all 0.4s ease' }}>
                      {wechatStep > i ? <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 700 }}>✓</span> : s.icon}
                    </div>
                    <span style={{ fontSize: 13, color: wechatStep > i ? '#16a34a' : wechatStep === i ? '#1d4ed8' : 'var(--text-tertiary)', fontWeight: wechatStep === i ? 600 : 400, transition: 'color 0.4s' }}>
                      {s.label}{wechatStep === i && <span style={{ marginLeft: 2 }}>···</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {wechatResult && !wechatLoading && (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: wechatResult.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${wechatResult.ok ? '#86efac' : '#fca5a5'}` }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: wechatResult.ok ? '#16a34a' : 'var(--error)' }}>{wechatResult.msg}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => { if (!wechatLoading) setShowWechat(false) }} style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', color: wechatLoading ? '#c4c4c4' : 'var(--text-primary)', fontSize: 13, fontWeight: 500, cursor: wechatLoading ? 'not-allowed' : 'pointer' }}>关闭</button>
              <button onClick={handleWechatSubmit} disabled={wechatLoading || !wechatUrl.trim()} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: wechatLoading || !wechatUrl.trim() ? '#86efac' : 'var(--success)', color: 'var(--bg-surface)', fontSize: 13, fontWeight: 600, cursor: wechatLoading || !wechatUrl.trim() ? 'not-allowed' : 'pointer' }}>
                {wechatLoading ? '导入中...' : '导入文章'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
