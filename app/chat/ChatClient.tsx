'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'

interface Assistant { id: string; name: string; dataset_ids: string[] }
interface Ref {
  id: string; document_id: string; document_name: string
  dataset_id: string; content: string; similarity: number
}
interface Message {
  role: 'user' | 'assistant'
  content: string
  refs?: Ref[]
  streaming?: boolean
}
interface ConversationRecord {
  id: string
  name: string
  assistantId: string
  sessionId: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}

function genId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

// ── Inline markdown parser ──────────────────────────────────────────────────
function parseInline(text: string): React.ReactNode[] {
  const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g
  const parts = text.split(pattern)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
      return <em key={i}>{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return <code key={i} style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontSize: '0.88em', fontFamily: 'ui-monospace, monospace', color: '#0f172a' }}>{part.slice(1, -1)}</code>
    return part
  })
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++ }
      elements.push(
        <pre key={elements.length} style={{ background: '#1e293b', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', margin: '6px 0', fontSize: 13, fontFamily: 'ui-monospace, monospace', lineHeight: 1.6 }}>
          <code style={{ color: '#e2e8f0' }}>{codeLines.join('\n')}</code>
        </pre>
      )
      i++; continue
    }
    if (line.startsWith('### ')) { elements.push(<h3 key={elements.length} style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '10px 0 4px' }}>{parseInline(line.slice(4))}</h3>); i++; continue }
    if (line.startsWith('## ')) { elements.push(<h2 key={elements.length} style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '12px 0 4px' }}>{parseInline(line.slice(3))}</h2>); i++; continue }
    if (line.startsWith('# ')) { elements.push(<h1 key={elements.length} style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '12px 0 6px' }}>{parseInline(line.slice(2))}</h1>); i++; continue }
    if (line.match(/^[-*]{3,}$/)) { elements.push(<hr key={elements.length} style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '8px 0' }} />); i++; continue }
    if (line.match(/^[-*] /)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^[-*] /)) { items.push(lines[i].slice(2)); i++ }
      elements.push(<ul key={elements.length} style={{ paddingLeft: 20, margin: '4px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>{items.map((item, j) => <li key={j} style={{ fontSize: 14, lineHeight: 1.6, color: '#1e293b' }}>{parseInline(item)}</li>)}</ul>)
      continue
    }
    if (line.match(/^\d+\. /)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^\d+\. /)) { items.push(lines[i].replace(/^\d+\. /, '')); i++ }
      elements.push(<ol key={elements.length} style={{ paddingLeft: 20, margin: '4px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>{items.map((item, j) => <li key={j} style={{ fontSize: 14, lineHeight: 1.6, color: '#1e293b' }}>{parseInline(item)}</li>)}</ol>)
      continue
    }
    if (line.trim() === '') { if (elements.length > 0) elements.push(<div key={elements.length} style={{ height: 4 }} />); i++; continue }
    elements.push(<p key={elements.length} style={{ margin: '2px 0', fontSize: 14, lineHeight: 1.7, color: '#1e293b' }}>{parseInline(line)}</p>)
    i++
  }
  return <div style={{ minWidth: 0 }}>{elements}</div>
}

// ── Document preview modal ──────────────────────────────────────────────────
function DocModal({ docName, datasetId, docId, onClose }: { docName: string; datasetId: string; docId: string; onClose: () => void }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`/api/documents/chunks?datasetId=${datasetId}&docId=${docId}`)
      .then(r => r.json()).then(d => {
        const chunks: { content: string }[] = d.data?.chunks || []
        setContent(chunks.map(c => c.content.trim()).join('\n\n---\n\n'))
      }).catch(() => setContent('无法加载文档内容')).finally(() => setLoading(false))
  }, [datasetId, docId])
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 640, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>📄</span><span style={{ fontWeight: 600, color: '#1e293b', fontSize: 14 }}>{docName}</span></div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {loading ? <div style={{ color: '#94a3b8', fontSize: 14 }}>加载中...</div>
            : <pre style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', lineHeight: 1.7, margin: 0 }}>{content}</pre>}
        </div>
      </div>
    </div>
  )
}

function RefList({ refs }: { refs: Ref[] }) {
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<Ref | null>(null)
  const unique = refs.filter((r, i, arr) => arr.findIndex(x => x.document_id === r.document_id) === i)
  if (unique.length === 0) return null
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(o => !o)} style={{ fontSize: 12, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
        <span>{open ? '▾' : '▸'}</span><span>来源依据 ({unique.length})</span>
      </button>
      {open && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {unique.map(ref => (
            <button key={ref.document_id} onClick={() => setModal(ref)} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8, background: '#eff6ff', border: 'none', cursor: 'pointer' }}>
              <span style={{ color: '#60a5fa', flexShrink: 0, marginTop: 2 }}>📄</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#1d4ed8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ref.document_name}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{ref.content.trim().slice(0, 120)}...</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {modal && <DocModal docName={modal.document_name} datasetId={modal.dataset_id} docId={modal.document_id} onClose={() => setModal(null)} />}
    </div>
  )
}

function ThinkingIndicator({ elapsed }: { elapsed: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', height: 16 }}>
          {[0, 150, 300].map(delay => <span key={delay} style={{ width: 6, height: 6, background: '#94a3b8', borderRadius: '50%', animation: 'bounce 1s infinite', animationDelay: `${delay}ms` }} />)}
        </span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{elapsed < 5 ? '正在思考...' : `正在检索知识库... (${elapsed}s)`}</span>
      </div>
      {elapsed >= 20 && (
        <div style={{ fontSize: 12, color: '#f59e0b', background: '#fffbeb', padding: '6px 10px', borderRadius: 6, border: '1px solid #fde68a' }}>
          知识库深度检索中（RAPTOR/GraphRAG），请稍候...
        </div>
      )}
    </div>
  )
}

// ── Main Chat ───────────────────────────────────────────────────────────────
export default function ChatClient({ userId, userName, role, permissionLevel }: {
  userId: string; userName: string; role: string; permissionLevel: number
}) {
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [selectedAsst, setSelectedAsst] = useState<string>('')
  const [conversations, setConversations] = useState<ConversationRecord[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [sessionId, setSessionId] = useState<string>('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initMsg, setInitMsg] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [selectedModel, setSelectedModel] = useState<'qwen' | 'gemma4'>('qwen')
  const [switchingModel, setSwitchingModel] = useState(false)
  const [favMsgIds, setFavMsgIds] = useState(new Set() as Set<number>)
  const [showCopyToast, setShowCopyToast] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const favMsgApiIds = useRef(new Map() as Map<number, string>)
  const copyToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editingConvId, setEditingConvId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  const storageKey = useCallback(() => `ekb_conversations_${userId}`, [userId])

  function loadAllConvs(): ConversationRecord[] {
    try { return JSON.parse(localStorage.getItem(storageKey()) || '[]') } catch { return [] }
  }
  function saveAllConvs(convs: ConversationRecord[]) {
    localStorage.setItem(storageKey(), JSON.stringify(convs))
  }

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [input])

  useEffect(() => {
    fetch('/api/chat/session').then(r => r.json()).then(d => {
      const all: Assistant[] = d.data || []
      const withKb = all.filter(a => a.dataset_ids && a.dataset_ids.length > 0)
      const sorted = [...withKb.filter(a => a.name.includes('协会')), ...withKb.filter(a => !a.name.includes('协会'))]
      setAssistants(sorted)
      if (sorted.length > 0) setSelectedAsst(sorted[0].id)
    })
    setConversations(loadAllConvs())
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  useEffect(() => {
    if (!selectedAsst) return
    const convs = loadAllConvs()
    const asstConvs = convs.filter(c => c.assistantId === selectedAsst).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    if (asstConvs.length > 0) {
      const conv = asstConvs[0]
      setActiveConvId(conv.id)
      setMessages(conv.messages)
      setInitMsg('连接中...')
      // Always create a fresh RAGFlow session to avoid expired session errors
      fetch('/api/chat/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantId: selectedAsst }),
      }).then(r => r.json()).then(d => {
        if (d.data?.id) {
          setSessionId(d.data.id)
          // Update stored sessionId
          const updated = loadAllConvs().map(c => c.id === conv.id ? { ...c, sessionId: d.data.id } : c)
          saveAllConvs(updated)
        } else {
          setSessionId(conv.sessionId)
        }
        setInitMsg('')
      }).catch(() => { setSessionId(conv.sessionId); setInitMsg('') })
    } else {
      startNewConversation(selectedAsst)
    }
  }, [selectedAsst])

  async function startNewConversation(asstId: string) {
    setInitMsg('正在创建会话...')
    setMessages([])
    setActiveConvId(null)
    setFavMsgIds(new Set())
    try {
      const r = await fetch('/api/chat/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantId: asstId }),
      })
      const d = await r.json()
      if (r.ok && d.data?.id) {
        const newConv: ConversationRecord = {
          id: genId(), name: '新对话', assistantId: asstId,
          sessionId: d.data.id, messages: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        }
        const convs = loadAllConvs()
        convs.push(newConv)
        saveAllConvs(convs)
        setConversations(convs)
        setActiveConvId(newConv.id)
        setSessionId(d.data.id)
        setInitMsg('')
      } else {
        setInitMsg(`会话创建失败: ${d.error || '未知错误'}`)
      }
    } catch (e) {
      setInitMsg('会话创建失败: ' + (e instanceof Error ? e.message : '网络错误'))
    }
  }

  function loadConversation(conv: ConversationRecord) {
    setActiveConvId(conv.id)
    setMessages(conv.messages)
    setSessionId(conv.sessionId)
    if (conv.assistantId !== selectedAsst) setSelectedAsst(conv.assistantId)
    setInitMsg('')
  }

  function deleteConversation(id: string) {
    const convs = loadAllConvs().filter(c => c.id !== id)
    saveAllConvs(convs)
    setConversations(convs)
    if (activeConvId === id) {
      const asstConvs = convs.filter(c => c.assistantId === selectedAsst).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      if (asstConvs.length > 0) loadConversation(asstConvs[0])
      else startNewConversation(selectedAsst)
    }
  }

  function updateConvName(id: string, name: string) {
    const convs = loadAllConvs().map(c => c.id === id ? { ...c, name } : c)
    saveAllConvs(convs)
    setConversations(convs)
  }

  async function generateName(convId: string, firstMessage: string) {
    try {
      const r = await fetch('/api/chat/name', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstMessage }),
      })
      const d = await r.json()
      if (d.name && d.name !== '新对话') updateConvName(convId, d.name)
    } catch {}
  }

  async function switchModel(model: 'qwen' | 'gemma4') {
    if (model === selectedModel || switchingModel || !selectedAsst) return
    setSwitchingModel(true)
    try {
      const r = await fetch('/api/chat/model', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantId: selectedAsst, model }),
      })
      if (r.ok) setSelectedModel(model)
    } catch {}
    setSwitchingModel(false)
  }

  function startTimer() {
    setElapsed(0)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setElapsed(0)
  }

  async function toggleMsgFav(idx: number, content: string) {
    if (favMsgIds.has(idx)) {
      setFavMsgIds(prev => { const s = new Set(Array.from(prev)); s.delete(idx); return s })
      const apiId = favMsgApiIds.current.get(idx)
      if (apiId) fetch('/api/favorites', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: apiId }) }).catch(() => {})
    } else {
      setFavMsgIds(prev => { const s = new Set(Array.from(prev)); s.add(idx); return s })
      try {
        const r = await fetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'message', content, conversationName: conversations.find(c => c.id === activeConvId)?.name || '对话' }) })
        const d = await r.json()
        if (d.data?.id) favMsgApiIds.current.set(idx, d.data.id)
      } catch {}
    }
  }

  function copyMsg(idx: number, content: string) {
    const showFeedback = () => {
      if (copyToastTimer.current) clearTimeout(copyToastTimer.current)
      setCopiedIdx(idx)
      setShowCopyToast(true)
      copyToastTimer.current = setTimeout(() => { setShowCopyToast(false); setCopiedIdx(null) }, 1500)
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(content).then(showFeedback).catch(() => fallbackCopy(content, showFeedback))
    } else {
      fallbackCopy(content, showFeedback)
    }
  }

  function fallbackCopy(content: string, cb: () => void) {
    const el = document.createElement('textarea')
    el.value = content
    el.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
    document.body.appendChild(el)
    el.focus(); el.select()
    try { document.execCommand('copy'); cb() } catch {}
    document.body.removeChild(el)
  }

  async function handleSend() {
    if (!input.trim() || !sessionId || loading) return
    const userMsg = input.trim()
    setInput('')
    const isFirst = messages.length === 0
    const convId = activeConvId!

    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setLoading(true)
    startTimer()
    setMessages([...newMessages, { role: 'assistant', content: '', streaming: true }])

    try {
      const r = await fetch('/api/chat/stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg, sessionId, assistantId: selectedAsst }),
      })
      if (!r.ok || !r.body) {
        const d = await r.json().catch(() => ({}))
        const errMsg: Message = { role: 'assistant', content: `错误: ${d.error || '请求失败'}` }
        const updated = [...newMessages, errMsg]
        setMessages(updated)
        persist(convId, updated)
        setLoading(false); stopTimer(); return
      }

      const reader = r.body.getReader()
      const decoder = new TextDecoder()
      let buffer = '', fullText = '', refs: Ref[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim()
          if (raw === 'true' || raw === '[DONE]') continue
          try {
            const obj = JSON.parse(raw)
            const delta = obj.data?.answer
            if (delta && typeof delta === 'string') {
              fullText += delta
              setMessages([...newMessages, { role: 'assistant', content: fullText, streaming: true }])
            }
            if (obj.data?.final === true && obj.data?.reference?.chunks?.length > 0) refs = obj.data.reference.chunks
          } catch {}
        }
      }

      const finalMsg: Message = {
        role: 'assistant',
        content: fullText || '知识库中未找到相关内容，请尝试换个问题描述。',
        refs: refs.length > 0 ? refs : undefined,
      }
      const updated = [...newMessages, finalMsg]
      setMessages(updated)
      persist(convId, updated)
      if (isFirst) generateName(convId, userMsg)
    } catch {
      const errMsg: Message = { role: 'assistant', content: '网络错误，请重试' }
      const updated = [...newMessages, errMsg]
      setMessages(updated)
      persist(convId, updated)
    }
    setLoading(false); stopTimer()
  }

  function persist(convId: string, msgs: Message[]) {
    const convs = loadAllConvs().map(c =>
      c.id === convId ? { ...c, messages: msgs.filter(m => !m.streaming), updatedAt: new Date().toISOString() } : c
    )
    saveAllConvs(convs)
    setConversations(convs)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function startEditName(conv: ConversationRecord) {
    setEditingConvId(conv.id)
    setEditingName(conv.name)
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  function commitEditName() {
    if (editingConvId && editingName.trim()) updateConvName(editingConvId, editingName.trim())
    setEditingConvId(null)
  }

  const asstConversations = conversations
    .filter(c => c.assistantId === selectedAsst)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#eef2fb', overflow: 'hidden', position: 'relative' }}>
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <div className="aurora aurora-3" />
      <Sidebar userName={userName} role={role} permissionLevel={permissionLevel} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ padding: '16px 28px 0', background: 'rgba(255,255,255,.75)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(59,130,246,.1)', flexShrink: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>AI 问答</h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>基于知识库的智能问答助手</p>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '14px 0 0' }}>
          {/* ── Main chat column ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 16px 16px', overflow: 'hidden', minWidth: 0 }}>

            {/* Controls bar - assistant selector only */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0, marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>助手:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, flex: 1 }}>
                {assistants.map(a => (
                  <button key={a.id} onClick={() => setSelectedAsst(a.id)}
                    style={{
                      padding: '4px 11px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                      background: selectedAsst === a.id ? '#2563eb' : '#fff',
                      color: selectedAsst === a.id ? '#fff' : '#374151',
                      border: selectedAsst === a.id ? '1.5px solid #2563eb' : '1.5px solid #e2e8f0',
                    }}>
                    {a.name}
                  </button>
                ))}
                {assistants.length === 0 && <span style={{ fontSize: 12, color: '#94a3b8' }}>加载中...</span>}
              </div>
            </div>

            {/* Chat messages area */}
            <div style={{ flex: 1, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {initMsg && <div style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8', padding: '16px 0' }}>{initMsg}</div>}
                {messages.length === 0 && !initMsg && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center', padding: '48px 0' }}>
                    <div style={{ fontSize: 44, marginBottom: 12 }}>💬</div>
                    <p style={{ color: '#64748b', fontSize: 14, fontWeight: 500, margin: '0 0 4px' }}>
                      {assistants.find(a => a.id === selectedAsst)?.name || '智能助手'}
                    </p>
                    <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>输入问题开始对话</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '82%', width: msg.role === 'user' ? 'auto' : '100%' }}>
                      <div style={{
                        borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        padding: '10px 14px', wordBreak: 'break-word', lineHeight: 1.6,
                        background: msg.role === 'user' ? '#2563eb' : '#f1f5f9',
                        color: msg.role === 'user' ? '#fff' : '#1e293b', fontSize: 14,
                      }}>
                        {msg.role === 'user' ? (
                          <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                        ) : msg.streaming && msg.content === '' ? (
                          <ThinkingIndicator elapsed={elapsed} />
                        ) : (
                          <MarkdownText text={msg.content} />
                        )}
                      </div>
                      {!msg.streaming && msg.role === 'assistant' && msg.content && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <button onClick={() => toggleMsgFav(i, msg.content)} title={favMsgIds.has(i) ? '取消收藏' : '收藏此回答'}
                            style={{ display: 'flex', alignItems: 'center', gap: 3, background: favMsgIds.has(i) ? '#fffbeb' : 'none',
                              border: favMsgIds.has(i) ? '1px solid #fde68a' : '1px solid transparent',
                              borderRadius: 6, cursor: 'pointer', fontSize: 13, padding: '2px 7px',
                              color: favMsgIds.has(i) ? '#f59e0b' : '#cbd5e1', transition: 'all 0.1s' }}
                            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#f59e0b'; el.style.background = '#fffbeb'; el.style.borderColor = '#fde68a' }}
                            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = favMsgIds.has(i) ? '#f59e0b' : '#cbd5e1'; el.style.background = favMsgIds.has(i) ? '#fffbeb' : 'none'; el.style.borderColor = favMsgIds.has(i) ? '#fde68a' : 'transparent' }}>
                            <span style={{ fontSize: 14 }}>{favMsgIds.has(i) ? '★' : '☆'}</span>
                            <span style={{ fontSize: 11 }}>{favMsgIds.has(i) ? '已收藏' : '收藏'}</span>
                          </button>
                          <button onClick={() => copyMsg(i, msg.content)} title="复制内容"
                            style={{ display: 'flex', alignItems: 'center', gap: 3,
                              background: copiedIdx === i ? '#f0fdf4' : 'none',
                              border: copiedIdx === i ? '1px solid #86efac' : '1px solid transparent',
                              borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '2px 7px',
                              color: copiedIdx === i ? '#16a34a' : '#cbd5e1', transition: 'all 0.1s' }}
                            onMouseEnter={e => { if (copiedIdx !== i) { const el = e.currentTarget as HTMLElement; el.style.color = '#475569'; el.style.background = '#f1f5f9'; el.style.borderColor = '#e2e8f0' } }}
                            onMouseLeave={e => { if (copiedIdx !== i) { const el = e.currentTarget as HTMLElement; el.style.color = '#cbd5e1'; el.style.background = 'none'; el.style.borderColor = 'transparent' } }}>
                            {copiedIdx === i
                              ? <><svg style={{ width: 12, height: 12 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg><span>已复制</span></>
                              : <><svg style={{ width: 12, height: 12 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><span>复制</span></>
                            }
                          </button>
                        </div>
                      )}
                      {msg.refs && msg.refs.length > 0 && <RefList refs={msg.refs} />}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input — unified box */}
              <div style={{
                borderTop: '1px solid #e8f0fe', flexShrink: 0,
                margin: '0 10px 10px', borderRadius: 16,
                border: '1.5px solid #93c5fd',
                boxShadow: '0 0 0 4px rgba(59,130,246,0.08), 0 2px 8px rgba(59,130,246,0.06)',
                background: '#fff', display: 'flex', flexDirection: 'column',
                transition: 'box-shadow 0.2s, border-color 0.2s',
              }}
                onFocusCapture={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 5px rgba(59,130,246,0.14), 0 2px 12px rgba(59,130,246,0.1)'; (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6' }}
                onBlurCapture={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 4px rgba(59,130,246,0.08), 0 2px 8px rgba(59,130,246,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = '#93c5fd' }}
              >
                <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder={sessionId ? '输入问题... (Enter 发送，Shift+Enter 换行)' : '会话初始化中...'}
                  disabled={!sessionId || loading} rows={5}
                  style={{
                    flex: 1, resize: 'none', fontSize: 14, color: '#1e293b',
                    border: 'none', borderRadius: '14px 14px 0 0',
                    padding: '14px 16px 8px', outline: 'none',
                    minHeight: 120, maxHeight: 240, overflowY: 'auto',
                    background: 'transparent',
                    cursor: (!sessionId || loading) ? 'not-allowed' : 'auto',
                    fontFamily: 'inherit', lineHeight: 1.6,
                  }}
                />
                {/* Bottom bar: model toggle left + send right */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px 10px' }}>
                  <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, gap: 2 }}>
                    {([
                      { key: 'qwen' as const, label: '⚡ 快速', title: 'Qwen2.5-VL-3B · 快速响应', activeColor: '#2563eb' },
                      { key: 'gemma4' as const, label: '🔍 深度', title: 'Gemma4 26B · 深度推理', activeColor: '#7c3aed' },
                    ]).map(({ key, label, title, activeColor }) => (
                      <button key={key} onClick={() => switchModel(key)} disabled={switchingModel} title={title}
                        style={{
                          padding: '4px 11px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          cursor: switchingModel ? 'wait' : 'pointer', border: 'none', transition: 'all 0.18s',
                          background: selectedModel === key ? activeColor : 'transparent',
                          color: selectedModel === key ? '#fff' : '#64748b',
                          opacity: switchingModel && selectedModel !== key ? 0.4 : 1,
                        }}>{label}</button>
                    ))}
                  </div>
                  <button onClick={handleSend} disabled={!input.trim() || !sessionId || loading}
                    title="发送"
                    style={{
                      width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
                      background: (!input.trim() || !sessionId || loading) ? '#cbd5e1' : '#2563eb',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s, transform 0.1s',
                      boxShadow: (!input.trim() || !sessionId || loading) ? 'none' : '0 2px 8px rgba(37,99,235,0.35)',
                    }}
                    onMouseEnter={e => { if (input.trim() && sessionId && !loading) (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}>
                    {loading
                      ? <svg style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z" /></svg>
                      : <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" /></svg>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── History panel ── */}
          <div style={{ width: 244, flexShrink: 0, background: '#fff', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>历史对话</span>
              <button onClick={() => startNewConversation(selectedAsst)}
                style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 9px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 12, color: '#374151', cursor: 'pointer', fontWeight: 500 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eff6ff'; (e.currentTarget as HTMLElement).style.borderColor = '#93c5fd' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0' }}>
                <svg style={{ width: 11, height: 11 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                新建
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '5px 6px' }}>
              {asstConversations.length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, padding: '28px 0' }}>暂无对话记录</div>
              )}
              {asstConversations.map(conv => {
                const isActive = conv.id === activeConvId
                const isEditing = conv.id === editingConvId
                const date = new Date(conv.updatedAt)
                const today = new Date()
                const isToday = date.toDateString() === today.toDateString()
                const dateStr = isToday
                  ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                  : date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
                return (
                  <div key={conv.id}
                    onClick={() => !isEditing && loadConversation(conv)}
                    style={{
                      padding: '8px 9px', borderRadius: 8, marginBottom: 2, cursor: 'pointer',
                      background: isActive ? '#eff6ff' : 'transparent', transition: 'background 0.15s',
                      border: isActive ? '1px solid #bfdbfe' : '1px solid transparent',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    {isEditing ? (
                      <input ref={editInputRef} value={editingName} onChange={e => setEditingName(e.target.value)}
                        onBlur={commitEditName}
                        onKeyDown={e => { if (e.key === 'Enter') commitEditName(); if (e.key === 'Escape') setEditingConvId(null) }}
                        onClick={e => e.stopPropagation()}
                        style={{ width: '100%', fontSize: 12, border: '1.5px solid #3b82f6', borderRadius: 5, padding: '2px 6px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? '#1d4ed8' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                            {conv.name}
                          </div>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                            {dateStr} · {conv.messages.length > 0 ? `${Math.floor(conv.messages.length / 2)} 轮` : '空白'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 1, flexShrink: 0, opacity: 0, transition: 'opacity 0.1s' }} className="hov-actions">
                          <button onClick={e => { e.stopPropagation(); startEditName(conv) }}
                            title="重命名"
                            style={{ padding: '2px 5px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4, color: '#94a3b8', fontSize: 11, lineHeight: 1 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e0f2fe'; (e.currentTarget as HTMLElement).style.color = '#0284c7' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}>
                            ✎
                          </button>
                          <button onClick={e => { e.stopPropagation(); if (confirm('删除此对话？')) deleteConversation(conv.id) }}
                            title="删除"
                            style={{ padding: '2px 5px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4, color: '#94a3b8', fontSize: 11, lineHeight: 1 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fee2e2'; (e.currentTarget as HTMLElement).style.color = '#ef4444' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}>
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Copy toast */}
      {showCopyToast && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: 'rgba(15,23,42,0.82)', color: '#fff', fontSize: 14, fontWeight: 500, padding: '10px 22px', borderRadius: 10, backdropFilter: 'blur(4px)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            已复制
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
        div:hover > .hov-actions,
        div:hover .hov-actions { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
