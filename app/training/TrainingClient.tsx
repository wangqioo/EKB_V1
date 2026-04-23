'use client'
import { useState, useEffect, useRef } from 'react'
import Sidebar from '@/components/Sidebar'

interface QuizQuestion { q: string; options: string[]; answer: number }
interface Course {
  id: string; title: string; description: string; content: string
  quiz: QuizQuestion[]; created_at: string; created_by: string
}
interface Progress { viewed: boolean; quiz_passed: boolean; quiz_score: number }
interface TrainingFile {
  id: string; originalName: string; storedName: string
  mimeType: string; size: number; uploadedAt: string; uploadedBy: string
}

function fmtSize(b: number) {
  if (b < 1024) return `${b}B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)}KB`
  return `${(b / 1048576).toFixed(1)}MB`
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return { bg: '#fee2e2', color: '#dc2626', label: 'PDF', emoji: '📄' }
  if (['doc', 'docx'].includes(ext)) return { bg: '#dbeafe', color: '#2563eb', label: 'DOC', emoji: '📝' }
  if (['ppt', 'pptx'].includes(ext)) return { bg: '#ffedd5', color: '#ea580c', label: 'PPT', emoji: '📊' }
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { bg: '#dcfce7', color: '#16a34a', label: 'XLS', emoji: '📋' }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return { bg: '#f3e8ff', color: '#7c3aed', label: 'VID', emoji: '🎬' }
  if (['mp3', 'wav', 'm4a'].includes(ext)) return { bg: '#fdf4ff', color: '#a21caf', label: 'AUD', emoji: '🎵' }
  if (['md', 'txt'].includes(ext)) return { bg: '#f1f5f9', color: '#64748b', label: 'TXT', emoji: '📃' }
  return { bg: '#f1f5f9', color: '#64748b', label: ext.toUpperCase().slice(0, 3) || 'FILE', emoji: '📎' }
}

function renderMd(text: string) {
  const lines = text.split('\n')
  const result: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('### ')) { result.push(<h3 key={i} style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '18px 0 8px' }}>{line.slice(4)}</h3>) }
    else if (line.startsWith('## ')) { result.push(<h2 key={i} style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '22px 0 10px' }}>{line.slice(3)}</h2>) }
    else if (line.startsWith('# ')) { result.push(<h1 key={i} style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '24px 0 12px' }}>{line.slice(2)}</h1>) }
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) { items.push(lines[i].slice(2)); i++ }
      result.push(<ul key={`ul-${i}`} style={{ margin: '8px 0', paddingLeft: 20 }}>{items.map((t, j) => <li key={j} style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>{t}</li>)}</ul>)
      continue
    }
    else if (line.trim() === '') { result.push(<div key={i} style={{ height: 8 }} />) }
    else { result.push(<p key={i} style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, margin: '4px 0' }}>{line}</p>) }
    i++
  }
  return result
}

interface Props { userName: string; role: string; userId: string; permissionLevel: number }

export default function TrainingClient({ userName, role, permissionLevel }: Props) {
  const [tab, setTab] = useState<'courses' | 'files'>('courses')
  const [courses, setCourses] = useState<Course[]>([])
  const [progress, setProgress] = useState<Record<string, Progress>>({})
  const [loading, setLoading] = useState(true)
  const [viewCourse, setViewCourse] = useState<Course | null>(null)
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState<number[]>([])
  const [quizResult, setQuizResult] = useState<{ passed: boolean; score: number; correct: number; total: number } | null>(null)
  const [submittingQuiz, setSubmittingQuiz] = useState(false)
  const [showAddCourse, setShowAddCourse] = useState(false)
  const [editCourse, setEditCourse] = useState<Course | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formQuiz, setFormQuiz] = useState<QuizQuestion[]>([])
  const [saving, setSaving] = useState(false)

  // Training files state
  const [trainingFiles, setTrainingFiles] = useState<TrainingFile[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [previewFile, setPreviewFile] = useState<TrainingFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const ACCEPTED_TYPES = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.mp4,.mov,.avi,.mkv,.webm,.mp3,.wav,.m4a,.txt,.md'
  const MAX_SIZE_MB = 500

  useEffect(() => {
    Promise.all([
      fetch('/api/courses').then(r => r.json()),
      fetch('/api/courses/progress').then(r => r.json()),
    ]).then(([c, p]) => {
      setCourses(c.data || [])
      setProgress(p.data || {})
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab === 'files') loadTrainingFiles()
  }, [tab])

  async function loadTrainingFiles() {
    setFilesLoading(true)
    const r = await fetch('/api/training/files')
    const d = await r.json()
    setTrainingFiles(d.data || [])
    setFilesLoading(false)
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files)
    const oversized = list.filter(f => f.size > MAX_SIZE_MB * 1024 * 1024)
    if (oversized.length > 0) {
      setUploadMsg(`⚠️ 文件超过 ${MAX_SIZE_MB}MB: ${oversized.map(f => f.name).join(', ')}`)
      return
    }
    setUploading(true)
    setUploadMsg('')
    let ok = 0
    for (const file of list) {
      const form = new FormData()
      form.append('file', file)
      try {
        const r = await fetch('/api/training/files', { method: 'POST', body: form })
        if (r.ok) ok++
      } catch {}
    }
    setUploadMsg(`✓ 成功上传 ${ok}/${list.length} 个文件`)
    setUploading(false)
    loadTrainingFiles()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (uploading) return
    const files = e.dataTransfer.files
    if (files.length > 0) uploadFiles(files)
  }

  async function deleteTrainingFile(id: string, name: string) {
    if (!confirm(`删除「${name}」？`)) return
    await fetch('/api/training/files', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setTrainingFiles(prev => prev.filter(f => f.id !== id))
  }

  function openFile(file: TrainingFile) {
    const ext = file.originalName.split('.').pop()?.toLowerCase() || ''
    if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'm4a'].includes(ext)) {
      setPreviewFile(file)
    } else {
      window.open(`/api/training/files/${file.id}`, '_blank')
    }
  }

  async function markViewed(courseId: string) {
    await fetch('/api/courses/progress', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, action: 'view' }),
    })
    setProgress(prev => ({ ...prev, [courseId]: { ...(prev[courseId] || { quiz_passed: false, quiz_score: 0 }), viewed: true } }))
  }

  async function submitQuiz() {
    if (!viewCourse) return
    setSubmittingQuiz(true)
    const r = await fetch('/api/courses/progress', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: viewCourse.id, action: 'quiz', answers: quizAnswers }),
    })
    const result = await r.json()
    setQuizResult(result)
    setSubmittingQuiz(false)
    if (result.passed) {
      setProgress(prev => ({ ...prev, [viewCourse.id]: { ...(prev[viewCourse.id] || { viewed: true, quiz_score: 0 }), quiz_passed: true, quiz_score: result.score } }))
    }
  }

  async function saveCourse() {
    setSaving(true)
    const body = { title: formTitle, description: formDesc, content: formContent, quiz: formQuiz }
    if (editCourse) {
      await fetch('/api/courses', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editCourse.id, ...body }) })
      setCourses(prev => prev.map(c => c.id === editCourse.id ? { ...c, ...body } : c))
    } else {
      const r = await fetch('/api/courses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      if (d.data) setCourses(prev => [...prev, d.data])
    }
    setSaving(false)
    setShowAddCourse(false); setEditCourse(null); resetForm()
  }

  async function deleteCourse(id: string) {
    if (!confirm('确认删除此课程？')) return
    await fetch('/api/courses', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setCourses(prev => prev.filter(c => c.id !== id))
  }

  function openAdd() { resetForm(); setShowAddCourse(true) }
  function openEdit(c: Course) {
    setFormTitle(c.title); setFormDesc(c.description); setFormContent(c.content); setFormQuiz(c.quiz || [])
    setEditCourse(c); setShowAddCourse(true)
  }
  function resetForm() { setFormTitle(''); setFormDesc(''); setFormContent(''); setFormQuiz([]) }
  function addQuizQ() { setFormQuiz(prev => [...prev, { q: '', options: ['', '', '', ''], answer: 0 }]) }
  function removeQuizQ(i: number) { setFormQuiz(prev => prev.filter((_, j) => j !== i)) }
  function updateQ(i: number, field: string, val: unknown) { setFormQuiz(prev => prev.map((q, j) => j === i ? { ...q, [field]: val } : q)) }
  function updateOpt(qi: number, oi: number, val: string) { setFormQuiz(prev => prev.map((q, j) => j !== qi ? q : { ...q, options: q.options.map((o, k) => k === oi ? val : o) })) }

  function getStatusBadge(c: Course) {
    const p = progress[c.id]
    if (p?.quiz_passed) return { label: '通过学习测验', color: '#16a34a', bg: '#dcfce7' }
    if (p?.viewed) return { label: '已学习', color: '#2563eb', bg: '#dbeafe' }
    return { label: '待学习', color: '#64748b', bg: '#f1f5f9' }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#eef2fb', position: 'relative' }}>
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <div className="aurora aurora-3" />
      <Sidebar userName={userName} role={role} permissionLevel={permissionLevel} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ padding: '16px 32px 0', background: 'rgba(255,255,255,.75)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(59,130,246,.1)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h1 style={{ fontSize: 19, fontWeight: 700, color: '#0f172a', margin: 0 }}>学习培训</h1>
              <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0 0' }}>企业内部课程与学习资料</p>
            </div>
            {role === 'admin' && tab === 'courses' && (
              <button onClick={openAdd}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                新增课程
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {([
              { key: 'courses' as const, label: '📚 培训课程' },
              { key: 'files' as const, label: '📁 资料库' },
            ]).map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)}
                style={{
                  padding: '8px 20px', fontSize: 13, fontWeight: tab === key ? 600 : 400,
                  color: tab === key ? '#2563eb' : '#64748b', background: 'none', border: 'none',
                  borderBottom: tab === key ? '2.5px solid #2563eb' : '2.5px solid transparent',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
          {/* ── COURSES TAB ── */}
          {tab === 'courses' && (
            loading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 14 }}>加载中...</div>
            ) : courses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
                <p style={{ color: '#64748b', fontSize: 15, fontWeight: 500 }}>暂无培训课程</p>
                {role === 'admin' && <p style={{ color: '#94a3b8', fontSize: 13 }}>点击右上角「新增课程」开始添加</p>}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {courses.map(c => {
                  const badge = getStatusBadge(c)
                  const p = progress[c.id]
                  return (
                    <div key={c.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: badge.bg, color: badge.color }}>{badge.label}</span>
                            {p?.quiz_passed && <span style={{ fontSize: 11, color: '#94a3b8' }}>得分 {p.quiz_score}%</span>}
                          </div>
                          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>{c.title}</h3>
                          {c.description && <p style={{ fontSize: 12, color: '#64748b', margin: '6px 0 0', lineHeight: 1.6 }}>{c.description}</p>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          {c.quiz.length > 0 ? `含 ${c.quiz.length} 道测题` : '无测验'} · {c.created_at.slice(0, 10)}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {role === 'admin' && (
                            <>
                              <button onClick={() => openEdit(c)}
                                style={{ background: 'none', border: 'none', fontSize: 12, color: '#64748b', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}>编辑</button>
                              <button onClick={() => deleteCourse(c.id)}
                                style={{ background: 'none', border: 'none', fontSize: 12, color: '#94a3b8', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = '#fef2f2' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; (e.currentTarget as HTMLElement).style.background = 'none' }}>删除</button>
                            </>
                          )}
                          <button onClick={() => { setViewCourse(c); setShowQuiz(false); setQuizResult(null); setQuizAnswers(Array(c.quiz.length).fill(-1)); markViewed(c.id) }}
                            style={{ padding: '5px 14px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {p?.viewed ? '再次查看' : '开始学习'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* ── FILES TAB ── */}
          {tab === 'files' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Upload zone */}
              {role === 'admin' && (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? '#3b82f6' : '#cbd5e1'}`,
                    borderRadius: 14, padding: '36px 24px', textAlign: 'center', cursor: uploading ? 'wait' : 'pointer',
                    background: dragOver ? '#eff6ff' : '#fff', transition: 'all 0.2s',
                  }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>{uploading ? '⏳' : dragOver ? '📂' : '☁️'}</div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>
                    {uploading ? '上传中...' : dragOver ? '松开以上传' : '拖拽文件到此处，或点击选择文件'}
                  </p>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                    支持：视频（MP4/MOV/AVI）、PPT、Word、PDF、Excel、音频、文本
                  </p>
                  {uploadMsg && (
                    <div style={{ marginTop: 10, fontSize: 13, color: uploadMsg.startsWith('✓') ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
                      {uploadMsg}
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_TYPES}
                    style={{ display: 'none' }}
                    onChange={e => { if (e.target.files) uploadFiles(e.target.files); e.target.value = '' }}
                  />
                </div>
              )}

              {/* File list */}
              {filesLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>加载中...</div>
              ) : trainingFiles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>📁</div>
                  <p style={{ color: '#64748b', fontSize: 14, fontWeight: 500 }}>暂无培训资料</p>
                  {role === 'admin' && <p style={{ color: '#94a3b8', fontSize: 12 }}>拖拽文件到上方区域即可上传</p>}
                </div>
              ) : (
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 18px', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
                    共 {trainingFiles.length} 个文件
                  </div>
                  {trainingFiles.map((file, idx) => {
                    const icon = getFileIcon(file.originalName)
                    const date = new Date(file.uploadedAt).toLocaleDateString('zh-CN')
                    return (
                      <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: idx < trainingFiles.length - 1 ? '1px solid #f8fafc' : 'none', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: icon.bg, color: icon.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                          {icon.emoji}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.originalName}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{fmtSize(file.size)} · {date} · 上传者: {file.uploadedBy}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => openFile(file)}
                            style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 12, color: '#374151', cursor: 'pointer', fontWeight: 500 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eff6ff'; (e.currentTarget as HTMLElement).style.borderColor = '#93c5fd' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0' }}>
                            查看
                          </button>
                          {role === 'admin' && (
                            <button onClick={() => deleteTrainingFile(file.id, file.originalName)}
                              style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'none', fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = '#fef2f2' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; (e.currentTarget as HTMLElement).style.background = 'none' }}>
                              删除
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Media preview modal */}
      {previewFile && (() => {
        const ext = previewFile.originalName.split('.').pop()?.toLowerCase() || ''
        const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)
        const src = `/api/training/files/${previewFile.id}`
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setPreviewFile(null)}>
            <div style={{ width: '100%', maxWidth: 900 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 500 }}>{previewFile.originalName}</span>
                <button onClick={() => setPreviewFile(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              {isVideo ? (
                <video controls autoPlay style={{ width: '100%', borderRadius: 12, maxHeight: '70vh', background: '#000' }} src={src} />
              ) : (
                <audio controls autoPlay style={{ width: '100%' }} src={src} />
              )}
            </div>
          </div>
        )
      })()}

      {/* Course view modal */}
      {viewCourse && !showQuiz && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0 }}>{viewCourse.title}</h2>
                {viewCourse.description && <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>{viewCourse.description}</p>}
              </div>
              <button onClick={() => setViewCourse(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#94a3b8', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}>×</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
              {viewCourse.content ? renderMd(viewCourse.content) : <p style={{ color: '#94a3b8', fontSize: 14 }}>（暂无内容）</p>}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setViewCourse(null)} style={{ padding: '8px 18px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>关闭</button>
              {viewCourse.quiz.length > 0 && !progress[viewCourse.id]?.quiz_passed && (
                <button onClick={() => setShowQuiz(true)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>开始测验 ({viewCourse.quiz.length}题)</button>
              )}
              {progress[viewCourse.id]?.quiz_passed && (
                <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  已通过测验 ({progress[viewCourse.id].quiz_score}%)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quiz modal */}
      {viewCourse && showQuiz && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>{viewCourse.title} — 学习测验</h2>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {viewCourse.quiz.map((q, qi) => (
                <div key={qi}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', margin: '0 0 10px' }}>{qi + 1}. {q.q}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {q.options.map((opt, oi) => (
                      <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 9, border: `1.5px solid ${quizAnswers[qi] === oi ? '#2563eb' : '#e2e8f0'}`, background: quizAnswers[qi] === oi ? '#eff6ff' : '#fff', cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                        <input type="radio" name={`q${qi}`} checked={quizAnswers[qi] === oi} onChange={() => setQuizAnswers(prev => { const a = [...prev]; a[qi] = oi; return a })} style={{ accentColor: '#2563eb' }} />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {quizResult && (
                <div style={{ padding: '16px', borderRadius: 10, background: quizResult.passed ? '#f0fdf4' : '#fef2f2', border: `1.5px solid ${quizResult.passed ? '#86efac' : '#fca5a5'}` }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: quizResult.passed ? '#16a34a' : '#dc2626' }}>
                    {quizResult.passed ? '恭喜！测验通过' : '未通过，请重新学习后再试'}
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>得分：{quizResult.score}% · 答对 {quizResult.correct}/{quizResult.total} 题</div>
                </div>
              )}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowQuiz(false); setQuizResult(null) }} style={{ padding: '8px 18px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>返回</button>
              {!quizResult && (
                <button onClick={submitQuiz} disabled={submittingQuiz || quizAnswers.some(a => a < 0)}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: quizAnswers.some(a => a < 0) ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {submittingQuiz ? '提交中...' : '提交答案'}
                </button>
              )}
              {quizResult && !quizResult.passed && (
                <button onClick={() => { setQuizResult(null); setQuizAnswers(Array(viewCourse.quiz.length).fill(-1)) }}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>重新作答</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit course modal */}
      {showAddCourse && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>{editCourse ? '编辑课程' : '新增课程'}</h2>
              <button onClick={() => { setShowAddCourse(false); setEditCourse(null); resetForm() }} style={{ background: 'none', border: 'none', fontSize: 20, color: '#94a3b8', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>课程标题 *</label>
                <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="例如：新员工入职培训" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>简介</label>
                <input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="简短描述" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>课程内容（支持 Markdown）</label>
                <textarea value={formContent} onChange={e => setFormContent(e.target.value)} rows={10} placeholder={'# 课程标题\n\n## 章节一\n\n内容...'} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box', outline: 'none', resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.6 }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>测验题目（可选）</label>
                  <button onClick={addQuizQ} style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', color: '#374151' }}>+ 添加题目</button>
                </div>
                {formQuiz.map((q, qi) => (
                  <div key={qi} style={{ background: '#f8fafc', borderRadius: 10, padding: '14px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <input value={q.q} onChange={e => updateQ(qi, 'q', e.target.value)} placeholder={`题目 ${qi + 1}`} style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none' }} />
                      <button onClick={() => removeQuizQ(qi)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>删除</button>
                    </div>
                    {q.options.map((opt, oi) => (
                      <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <input type="radio" name={`correct-${qi}`} checked={q.answer === oi} onChange={() => updateQ(qi, 'answer', oi)} style={{ accentColor: '#16a34a' }} />
                        <input value={opt} onChange={e => updateOpt(qi, oi, e.target.value)} placeholder={`选项 ${String.fromCharCode(65 + oi)}`} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none' }} />
                      </div>
                    ))}
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>点击左侧单选按钮标记正确答案</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAddCourse(false); setEditCourse(null); resetForm() }} style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>取消</button>
              <button onClick={saveCourse} disabled={saving || !formTitle.trim()} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: !formTitle.trim() ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? '保存中...' : '保存课程'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
