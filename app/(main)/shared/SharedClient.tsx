'use client'
import { useState, useEffect, useRef } from 'react'

interface DocVersion {
  v: number; fileName: string; storedName: string; size: number
  uploadedBy: string; uploadedByName: string; note: string; at: string
}
interface SharedDoc {
  id: string; title: string; description: string
  status: 'available' | 'checked_out'
  checkedOutBy: string | null; checkedOutByName: string | null; checkedOutAt: string | null
  currentVersion: number; createdBy: string; createdByName: string; createdAt: string
  versions: DocVersion[]
}

function fmtSize(b: number) {
  if (b < 1024) return `${b}B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)}KB`
  return `${(b / 1048576).toFixed(1)}MB`
}
function fmtDate(s: string) {
  return new Date(s).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtDateFull(s: string) {
  return new Date(s).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return { bg: '#fee2e2', color: '#dc2626', label: 'PDF' }
  if (['doc', 'docx'].includes(ext)) return { bg: '#dbeafe', color: 'var(--accent)', label: 'DOC' }
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { bg: '#dcfce7', color: '#16a34a', label: 'XLS' }
  if (['ppt', 'pptx'].includes(ext)) return { bg: '#ffedd5', color: '#ea580c', label: 'PPT' }
  if (['md', 'txt'].includes(ext)) return { bg: '#f3e8ff', color: '#7c3aed', label: 'TXT' }
  return { bg: 'var(--bg-elevated)', color: 'var(--text-secondary)', label: ext.toUpperCase().slice(0, 3) || 'FILE' }
}

interface Props { userId: string; userName: string; role: string; permissionLevel: number }

export default function SharedClient({ userId, userName, role, permissionLevel }: Props) {
  const [docs, setDocs] = useState<SharedDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDoc, setSelectedDoc] = useState<SharedDoc | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgErr, setMsgErr] = useState(false)

  // New doc modal
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newNote, setNewNote] = useState('初始版本')
  const [newFile, setNewFile] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const newFileRef = useRef<HTMLInputElement>(null)

  // Check-in modal
  const [showCheckin, setShowCheckin] = useState(false)
  const [checkinFile, setCheckinFile] = useState<File | null>(null)
  const [checkinNote, setCheckinNote] = useState('')
  const [checkinError, setCheckinError] = useState('')
  const checkinFileRef = useRef<HTMLInputElement>(null)

  const isAdmin = role === 'admin'

  async function load() {
    const r = await fetch('/api/shared')
    const d = await r.json()
    setDocs(d.docs || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function flash(text: string, err = false) {
    setMsg(text); setMsgErr(err)
    setTimeout(() => setMsg(''), 3000)
  }

  // Refresh selected doc from list
  function syncSelected(updated: SharedDoc[]) {
    if (selectedDoc) {
      const fresh = updated.find(d => d.id === selectedDoc.id)
      if (fresh) setSelectedDoc(fresh)
    }
  }

  async function handleCheckout(doc: SharedDoc) {
    setActionLoading(true)
    const form = new FormData()
    form.append('action', 'checkout'); form.append('docId', doc.id)
    const r = await fetch('/api/shared/checkout', { method: 'POST', body: form })
    const d = await r.json()
    if (!r.ok) { flash(d.error || '签出失败', true) }
    else {
      flash(`已签出「${doc.title}」，请下载最新版本编辑后再签入`)
      await load().then(() => setDocs(prev => { syncSelected(prev); return prev }))
    }
    setActionLoading(false)
    await load()
  }

  async function handleCancel(doc: SharedDoc) {
    if (!confirm('确认取消签出？编辑内容将不会保存为新版本。')) return
    setActionLoading(true)
    const form = new FormData()
    form.append('action', 'cancel'); form.append('docId', doc.id)
    const r = await fetch('/api/shared/checkout', { method: 'POST', body: form })
    const d = await r.json()
    if (!r.ok) flash(d.error || '取消失败', true)
    else flash('已取消签出')
    await load()
    setActionLoading(false)
  }

  async function handleCheckin() {
    if (!selectedDoc || !checkinFile) { setCheckinError('请选择文件'); return }
    setActionLoading(true); setCheckinError('')
    const form = new FormData()
    form.append('action', 'checkin')
    form.append('docId', selectedDoc.id)
    form.append('file', checkinFile)
    form.append('note', checkinNote.trim() || `Version ${selectedDoc.currentVersion + 1}`)
    const r = await fetch('/api/shared/checkout', { method: 'POST', body: form })
    const d = await r.json()
    if (!r.ok) { setCheckinError(d.error || '签入失败') }
    else {
      setShowCheckin(false); setCheckinFile(null); setCheckinNote('')
      flash(`✓ 已签入 V${selectedDoc.currentVersion + 1}`)
      await load()
    }
    setActionLoading(false)
  }

  async function handleCreate() {
    setCreateError('')
    if (!newTitle.trim()) { setCreateError('请填写文档标题'); return }
    if (!newFile) { setCreateError('请上传初始文件'); return }
    setCreating(true)
    const form = new FormData()
    form.append('title', newTitle.trim())
    form.append('description', newDesc.trim())
    form.append('note', newNote.trim() || '初始版本')
    form.append('file', newFile)
    const r = await fetch('/api/shared', { method: 'POST', body: form })
    const d = await r.json()
    setCreating(false)
    if (!r.ok) { setCreateError(d.error || '创建失败') }
    else {
      setShowNew(false); setNewTitle(''); setNewDesc(''); setNewNote('初始版本'); setNewFile(null)
      flash('✓ 共享文档已创建')
      await load()
    }
  }

  async function handleDelete(doc: SharedDoc) {
    if (!confirm(`确认删除「${doc.title}」及所有版本？此操作不可撤销。`)) return
    const r = await fetch('/api/shared', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId: doc.id }),
    })
    if (r.ok) {
      flash('已删除')
      if (selectedDoc?.id === doc.id) setSelectedDoc(null)
      await load()
    }
  }

  function downloadVersion(docId: string, v?: number) {
    const url = `/api/shared/download?docId=${docId}${v ? `&v=${v}` : ''}`
    const a = document.createElement('a'); a.href = url; document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  return (
    <>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ padding: '16px 28px 14px', background: 'rgba(255,255,255,.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(59,130,246,.1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>共享文档</h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '3px 0 0' }}>多人协作 · 版本控制 · Check In / Check Out</p>
          </div>
          <button onClick={() => { setShowNew(true); setCreateError(''); setNewTitle(''); setNewDesc(''); setNewNote('初始版本'); setNewFile(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: 'linear-gradient(135deg,#2563eb,#6366f1)', color: 'var(--bg-surface)', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,.35)' }}>
            <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            新建共享文档
          </button>
        </div>

        {msg && (
          <div style={{ padding: '10px 28px', background: msgErr ? '#fef2f2' : '#f0fdf4', borderBottom: `1px solid ${msgErr ? '#fecaca' : '#bbf7d0'}`, fontSize: 13, color: msgErr ? '#dc2626' : '#16a34a', flexShrink: 0 }}>
            {msg}
          </div>
        )}

        {/* Body: split list + detail */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Doc list */}
          <div style={{ width: 380, flexShrink: 0, borderRight: '1px solid #e8edf5', overflow: 'auto', background: 'rgba(255,255,255,0.5)' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>加载中...</div>
            ) : docs.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📁</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>暂无共享文档</div>
                <div style={{ fontSize: 12 }}>点击右上角「新建共享文档」开始</div>
              </div>
            ) : docs.map(doc => {
              const isMe = doc.checkedOutBy === userId
              const isLocked = doc.status === 'checked_out'
              const fi = getFileIcon(doc.versions[doc.versions.length - 1]?.fileName || '')
              const isSelected = selectedDoc?.id === doc.id

              return (
                <div key={doc.id} onClick={() => setSelectedDoc(doc)}
                  style={{ padding: '14px 18px', borderBottom: '1px solid #e8edf5', cursor: 'pointer', background: isSelected ? 'rgba(239,246,255,0.9)' : 'transparent', borderLeft: `3px solid ${isSelected ? '#2563eb' : 'transparent'}`, transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(239,246,255,0.5)' }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 38, height: 38, background: fi.bg, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: fi.color }}>{fi.label}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{doc.title}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 1099, flexShrink: 0, background: isLocked ? (isMe ? '#fffbeb' : '#fee2e2') : '#f0fdf4', color: isLocked ? (isMe ? '#d97706' : '#dc2626') : '#16a34a' }}>
                          {isLocked ? (isMe ? '📌 我在编辑' : `🔒 ${doc.checkedOutByName}`) : '✓ 可签出'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#6366f1' }}>V{doc.currentVersion}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{doc.versions.length} 个版本</span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {fmtDate(doc.versions[doc.versions.length - 1].at)}</span>
                      </div>
                      {doc.description && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.description}</div>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Detail panel */}
          <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
            {!selectedDoc ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>👆</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>从左侧选择一份文档</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>查看版本历史和协作状态</div>
              </div>
            ) : (() => {
              const doc = selectedDoc
              const isMe = doc.checkedOutBy === userId
              const isLocked = doc.status === 'checked_out'
              const latestV = doc.versions[doc.versions.length - 1]
              const fi = getFileIcon(latestV?.fileName || '')

              return (
                <div style={{ maxWidth: 700 }}>
                  {/* Doc header */}
                  <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid #e8edf5', padding: '20px 24px', marginBottom: 16, boxShadow: '0 2px 8px rgba(59,130,246,.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                      <div style={{ width: 48, height: 48, background: fi.bg, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: fi.color }}>{fi.label}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{doc.title}</div>
                        {doc.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{doc.description}</div>}
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                          创建者：{doc.createdByName} · {fmtDateFull(doc.createdAt)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        {isAdmin && (
                          <button onClick={() => handleDelete(doc)}
                            style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                            删除
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Status banner */}
                    <div style={{ padding: '12px 16px', borderRadius: 12, background: isLocked ? (isMe ? '#fffbeb' : '#fef2f2') : '#f0fdf4', border: `1px solid ${isLocked ? (isMe ? '#fde68a' : '#fecaca') : '#bbf7d0'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>{isLocked ? (isMe ? '📌' : '🔒') : '✅'}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: isLocked ? (isMe ? '#d97706' : '#dc2626') : '#16a34a' }}>
                            {isLocked ? (isMe ? '你已签出此文档，正在编辑中' : `${doc.checkedOutByName} 正在编辑`) : '文档可签出'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                            {isLocked
                              ? `签出时间：${fmtDateFull(doc.checkedOutAt || '')}`
                              : `当前版本：V${doc.currentVersion} · 上次编辑：${doc.versions[doc.versions.length - 1].uploadedByName}`
                            }
                          </div>
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        {/* Download latest */}
                        <button onClick={() => downloadVersion(doc.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                          <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          下载 V{doc.currentVersion}
                        </button>
                        {!isLocked && (
                          <button onClick={() => handleCheckout(doc)} disabled={actionLoading}
                            style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2563eb,#6366f1)', color: 'var(--bg-surface)', fontSize: 12, fontWeight: 600, cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.7 : 1 }}>
                            签出编辑
                          </button>
                        )}
                        {isLocked && isMe && (
                          <>
                            <button onClick={() => { setShowCheckin(true); setCheckinFile(null); setCheckinNote(''); setCheckinError('') }}
                              style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#059669,#10b981)', color: 'var(--bg-surface)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                              签入新版本
                            </button>
                            <button onClick={() => handleCancel(doc)} disabled={actionLoading}
                              style={{ padding: '7px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                              取消签出
                            </button>
                          </>
                        )}
                        {isLocked && !isMe && isAdmin && (
                          <button onClick={() => handleCancel(doc)} disabled={actionLoading}
                            style={{ padding: '7px 14px', borderRadius: 10, border: '1.5px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>
                            强制取消
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Version timeline */}
                  <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid #e8edf5', overflow: 'hidden', boxShadow: '0 2px 8px rgba(59,130,246,.05)' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>版本历史</span>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{doc.versions.length} 个版本</span>
                    </div>
                    <div style={{ padding: '8px 0' }}>
                      {[...doc.versions].reverse().map((v, i) => {
                        const isLatest = v.v === doc.currentVersion
                        const vFi = getFileIcon(v.fileName)
                        return (
                          <div key={v.v} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 20px', borderBottom: i < doc.versions.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                            {/* Timeline line */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 2 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isLatest ? 'linear-gradient(135deg,#2563eb,#6366f1)' : 'var(--bg-elevated)', color: isLatest ? '#fff' : 'var(--text-tertiary)', fontWeight: 700, fontSize: 11 }}>
                                V{v.v}
                              </div>
                              {i < doc.versions.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 20, background: '#e2e8f0', marginTop: 4 }} />}
                            </div>
                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <div style={{ width: 28, height: 28, background: vFi.bg, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <span style={{ fontSize: 9, fontWeight: 800, color: vFi.color }}>{vFi.label}</span>
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{v.fileName}</span>
                                {isLatest && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 1099, background: '#eff6ff', color: 'var(--accent)', flexShrink: 0 }}>最新</span>}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.note}</span>
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {v.uploadedByName} · {fmtDateFull(v.at)} · {fmtSize(v.size)}</span>
                              </div>
                            </div>
                            <button onClick={() => downloadVersion(doc.id, v.v)}
                              style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>
                              下载
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* New doc modal */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setShowNew(false) }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, width: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>新建共享文档</span>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-tertiary)', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>文档标题 <span style={{ color: '#ef4444' }}>*</span></label>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="例如：劳动合同模板"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>文档说明（可选）</label>
                <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="简短描述文档用途"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>初始文件 <span style={{ color: '#ef4444' }}>*</span></label>
                <div onClick={() => newFileRef.current?.click()} style={{ border: '1.5px dashed #c7d8f8', borderRadius: 10, padding: '14px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-elevated)' }}>
                  {newFile ? (
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{newFile.name} ({fmtSize(newFile.size)})</span>
                  ) : (
                    <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>点击选择文件（任意格式）</span>
                  )}
                </div>
                <input ref={newFileRef} type="file" style={{ display: 'none' }} onChange={e => setNewFile(e.target.files?.[0] || null)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>版本备注</label>
                <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="初始版本"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              {createError && <div style={{ color: '#ef4444', fontSize: 13, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '9px 12px' }}>{createError}</div>}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNew(false)} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}>取消</button>
              <button onClick={handleCreate} disabled={creating}
                style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2563eb,#6366f1)', color: 'var(--bg-surface)', fontSize: 13, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1 }}>
                {creating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check-in modal */}
      {showCheckin && selectedDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setShowCheckin(false) }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>签入新版本</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>将生成 V{selectedDoc.currentVersion + 1}</div>
              </div>
              <button onClick={() => setShowCheckin(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-tertiary)', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>新版本文件 <span style={{ color: '#ef4444' }}>*</span></label>
                <div onClick={() => checkinFileRef.current?.click()} style={{ border: '1.5px dashed #c7d8f8', borderRadius: 10, padding: '14px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-elevated)' }}>
                  {checkinFile ? (
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{checkinFile.name} ({fmtSize(checkinFile.size)})</span>
                  ) : (
                    <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>点击选择编辑后的文件</span>
                  )}
                </div>
                <input ref={checkinFileRef} type="file" style={{ display: 'none' }} onChange={e => setCheckinFile(e.target.files?.[0] || null)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>修改说明</label>
                <input value={checkinNote} onChange={e => setCheckinNote(e.target.value)} placeholder={`Version ${selectedDoc.currentVersion + 1}`}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              {checkinError && <div style={{ color: '#ef4444', fontSize: 13, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '9px 12px' }}>{checkinError}</div>}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCheckin(false)} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}>取消</button>
              <button onClick={handleCheckin} disabled={actionLoading}
                style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#059669,#10b981)', color: 'var(--bg-surface)', fontSize: 13, fontWeight: 600, cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.7 : 1 }}>
                {actionLoading ? '签入中...' : '确认签入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
