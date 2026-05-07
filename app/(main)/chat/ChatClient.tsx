'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

interface Assistant { id: string; name: string; dataset_ids: string[] }
interface Ref {
  id: string; document_id: string; document_name: string
  dataset_id: string; content: string; similarity: number
}
interface WebRef { title: string; url: string; snippet: string }
interface Message {
  role: 'user' | 'assistant'
  content: string
  refs?: Ref[]
  webRefs?: WebRef[]
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
      return <code key={i} style={{ background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4, fontSize: '0.88em', fontFamily: 'ui-monospace, monospace', color: 'var(--text-primary)' }}>{part.slice(1, -1)}</code>
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
        <pre key={elements.length} style={{ background: 'var(--text-primary)', borderRadius: 10, padding: '12px 14px', overflowX: 'auto', margin: '6px 0', fontSize: 13, fontFamily: 'ui-monospace, monospace', lineHeight: 1.6 }}>
          <code style={{ color: '#e2e8f0' }}>{codeLines.join('\n')}</code>
        </pre>
      )
      i++; continue
    }
    if (line.startsWith('### ')) { elements.push(<h3 key={elements.length} style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '10px 0 4px' }}>{parseInline(line.slice(4))}</h3>); i++; continue }
    if (line.startsWith('## ')) { elements.push(<h2 key={elements.length} style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '12px 0 4px' }}>{parseInline(line.slice(3))}</h2>); i++; continue }
    if (line.startsWith('# ')) { elements.push(<h1 key={elements.length} style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: '12px 0 6px' }}>{parseInline(line.slice(2))}</h1>); i++; continue }
    if (line.match(/^[-*]{3,}$/)) { elements.push(<hr key={elements.length} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />); i++; continue }
    if (line.match(/^[-*] /)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^[-*] /)) { items.push(lines[i].slice(2)); i++ }
      elements.push(<ul key={elements.length} style={{ paddingLeft: 20, margin: '4px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>{items.map((item, j) => <li key={j} style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)' }}>{parseInline(item)}</li>)}</ul>)
      continue
    }
    if (line.match(/^\d+\. /)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^\d+\. /)) { items.push(lines[i].replace(/^\d+\. /, '')); i++ }
      elements.push(<ol key={elements.length} style={{ paddingLeft: 20, margin: '4px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>{items.map((item, j) => <li key={j} style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)' }}>{parseInline(item)}</li>)}</ol>)
      continue
    }
    if (line.trim() === '') { if (elements.length > 0) elements.push(<div key={elements.length} style={{ height: 4 }} />); i++; continue }
    elements.push(<p key={elements.length} style={{ margin: '2px 0', fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)' }}>{parseInline(line)}</p>)
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
      <div style={{ background: 'var(--bg-surface)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 640, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>📄</span><span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{docName}</span></div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-tertiary)', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {loading ? <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>加载中...</div>
            : <pre style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', lineHeight: 1.7, margin: 0 }}>{content}</pre>}
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
      <button onClick={() => setOpen(o => !o)} style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
        <span>{open ? '▾' : '▸'}</span><span>来源依据 ({unique.length})</span>
      </button>
      {open && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {unique.map(ref => (
            <button key={ref.document_id} onClick={() => setModal(ref)} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 10, background: '#eff6ff', border: 'none', cursor: 'pointer' }}>
              <span style={{ color: '#60a5fa', flexShrink: 0, marginTop: 2 }}>📄</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#1d4ed8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ref.document_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{ref.content.trim().slice(0, 120)}...</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {modal && <DocModal docName={modal.document_name} datasetId={modal.dataset_id} docId={modal.document_id} onClose={() => setModal(null)} />}
    </div>
  )
}

function WebRefList({ refs }: { refs: WebRef[] }) {
  const [open, setOpen] = useState(false)
  if (refs.length === 0) return null
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(o => !o)} style={{ fontSize: 12, color: '#0ea5e9', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
        <svg style={{ width: 12, height: 12 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <span>{open ? '▾' : '▸'}</span><span>网络来源 ({refs.length})</span>
      </button>
      {open && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {refs.map((ref, i) => (
            <a key={i} href={ref.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 10, background: '#f0f9ff', border: '1px solid #bae6fd', textDecoration: 'none' }}>
              <svg style={{ width: 14, height: 14, color: '#0ea5e9', flexShrink: 0, marginTop: 1 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#0369a1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ref.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>{ref.snippet.slice(0, 120)}{ref.snippet.length > 120 ? '...' : ''}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function ThinkingIndicator({ elapsed, webSearch }: { elapsed: number; webSearch?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', height: 16 }}>
          {[0, 150, 300].map(delay => <span key={delay} style={{ width: 6, height: 6, background: 'var(--text-tertiary)', borderRadius: '50%', animation: 'bounce 1s infinite', animationDelay: `${delay}ms` }} />)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {webSearch
            ? elapsed < 3 ? '联网搜索中...' : `正在分析网络信息... (${elapsed}s)`
            : elapsed < 5 ? '正在思考...' : `正在检索知识库... (${elapsed}s)`}
        </span>
      </div>
      {elapsed >= 20 && !webSearch && (
        <div style={{ fontSize: 12, color: '#f59e0b', background: '#fffbeb', padding: '6px 10px', borderRadius: 6, border: '1px solid #fde68a' }}>
          知识库深度检索中（RAPTOR/GraphRAG），请稍候...
        </div>
      )}
    </div>
  )
}

// ── Welcome Screen ──────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: '📋', title: '查询规章制度', desc: '搜索公司最新规范、流程与制度文档' },
  { icon: '📊', title: '分析业务数据', desc: '帮你解读报表、总结关键数据指标' },
  { icon: '🔍', title: '知识库检索', desc: '从企业文档中精准定位所需信息' },
  { icon: '✍️', title: '起草文稿内容', desc: '协助撰写报告、通知或工作总结' },
]

function WelcomeScreen({ assistantName, onSuggest, fileCount, initMsg }: {
  assistantName: string
  onSuggest: (text: string) => void
  fileCount: number | null
  initMsg: string
}) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px 16px', overflow: 'hidden',
      animation: 'fadeInUp 0.4s ease both',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, marginBottom: 20,
        boxShadow: '0 8px 32px rgba(37,99,235,0.25)',
        animation: 'floatLogo 3s ease-in-out infinite',
      }}>💬</div>
      <div style={{
        fontSize: 22, fontWeight: 700, color: 'var(--text-primary)',
        marginBottom: 6, letterSpacing: '-0.3px',
      }}>你好，我是{assistantName}</div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>
        有什么我可以帮助你的吗？
      </div>
      {/* File count / status line */}
      <div style={{ fontSize: 12, marginBottom: 28, height: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
        {initMsg ? (
          <span style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ display: 'inline-flex', gap: 3 }}>
              {[0, 120, 240].map(d => (
                <span key={d} style={{ width: 4, height: 4, background: '#cbd5e1', borderRadius: '50%', animation: 'bounce 1s infinite', animationDelay: `${d}ms` }} />
              ))}
            </span>
            {initMsg}
          </span>
        ) : fileCount !== null ? (
          <span style={{
            color: 'var(--accent)', background: 'rgba(59,130,246,0.07)',
            padding: '3px 10px', borderRadius: 20,
            border: '1px solid rgba(59,130,246,0.15)', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <svg style={{ width: 11, height: 11 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            将基于知识库中的 <strong style={{ color: 'var(--accent)' }}>{fileCount}</strong> 个文件进行回答
          </span>
        ) : null}
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 10, width: '100%', maxWidth: 560,
      }}>
        {SUGGESTIONS.map((s, i) => (
          <button key={i} onClick={() => onSuggest(s.title)}
            style={{
              padding: '14px 16px', borderRadius: 14, textAlign: 'left',
              background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
              cursor: 'pointer', transition: 'all 0.2s',
              animation: `fadeInUp 0.4s ease both`,
              animationDelay: `${0.08 * (i + 1)}s`,
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = '#93c5fd'
              el.style.background = '#eff6ff'
              el.style.transform = 'translateY(-2px)'
              el.style.boxShadow = '0 6px 20px rgba(37,99,235,0.10)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = '#e2e8f0'
              el.style.background = '#fff'
              el.style.transform = 'translateY(0)'
              el.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: 18, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{s.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{s.desc}</div>
          </button>
        ))}
      </div>
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
  const [deepThinkEnabled, setDeepThinkEnabled] = useState(false)

  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [fileCount, setFileCount] = useState<number | null>(null)
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
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [input])

  useEffect(() => {
    fetch('/api/chat/session').then(r => r.json()).then(d => {
      const all: Assistant[] = d.data || []
      const withKb = all
      const sorted = [...withKb.filter(a => a.name.includes('协会')), ...withKb.filter(a => !a.name.includes('协会'))]
      setAssistants(sorted)
      if (sorted.length > 0) setSelectedAsst(sorted[0].id)
    })
    setConversations(loadAllConvs())
  }, [])

  // Fetch document count for the selected assistant's datasets
  useEffect(() => {
    if (!selectedAsst || !assistants.length) return
    const asst = assistants.find(a => a.id === selectedAsst)
    if (!asst?.dataset_ids?.length) { setFileCount(null); return }
    fetch('/api/datasets')
      .then(r => r.json())
      .then(d => {
        const datasets: { id: string; document_count?: number }[] = d.data || []
        const total = datasets
          .filter(ds => asst.dataset_ids.includes(ds.id))
          .reduce((sum, ds) => sum + (ds.document_count || 0), 0)
        setFileCount(total > 0 ? total : null)
      })
      .catch(() => setFileCount(null))
  }, [selectedAsst, assistants])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  useEffect(() => {
    if (!selectedAsst) return
    // Always start fresh so the welcome screen shows on page load.
    // Previous conversations remain in the history panel and can be loaded by clicking them.
    startNewConversation(selectedAsst)
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

  function toggleDeepThink() {
    setDeepThinkEnabled(e => !e)
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
      if (deepThinkEnabled && !webSearchEnabled) {
        // ── Deep think path: RAGFlow retrieval → DeepSeek generation ──
        const r = await fetch('/api/chat/deepstream', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: userMsg, assistantId: selectedAsst }),
        })
        if (!r.ok || !r.body) {
          const d = await r.json().catch(() => ({}))
          const errMsg: Message = { role: 'assistant', content: `错误: ${d.error || '深度思考请求失败'}` }
          const updated = [...newMessages, errMsg]
          setMessages(updated); persist(convId, updated)
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
          content: fullText || '知识库中未找到相关内容，请换个问题描述。',
          refs: refs.length > 0 ? refs : undefined,
        }
        const updated = [...newMessages, finalMsg]
        setMessages(updated)
        persist(convId, updated)
        if (isFirst) generateName(convId, userMsg)
      } else if (webSearchEnabled) {
        // ── Web search path: Bing search → webstream (with optional deep think model) ──
        let webResults: WebRef[] = []
        let searchQuery = userMsg
        try {
          const wr = await fetch(`/api/chat/websearch?q=${encodeURIComponent(userMsg)}`)
          const wd = await wr.json()
          webResults = wd.results || []
          searchQuery = wd.query || userMsg
        } catch {}

        const r = await fetch('/api/chat/webstream', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: userMsg, webResults, model: 'deepseek', searchQuery }),
        })
        if (!r.ok || !r.body) {
          const d = await r.json().catch(() => ({}))
          const errMsg: Message = { role: 'assistant', content: `错误: ${d.error || '联网问答失败'}` }
          const updated = [...newMessages, errMsg]
          setMessages(updated); persist(convId, updated)
          setLoading(false); stopTimer(); return
        }
        const reader = r.body.getReader()
        const decoder = new TextDecoder()
        let buffer = '', fullText = ''
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
            } catch {}
          }
        }
        const finalMsg: Message = {
          role: 'assistant',
          content: fullText || '联网搜索未找到相关内容，请换个问题描述。',
          webRefs: webResults.length > 0 ? webResults : undefined,
        }
        const updated = [...newMessages, finalMsg]
        setMessages(updated)
        persist(convId, updated)
        if (isFirst) generateName(convId, userMsg)
      } else {
        // ── RAGFlow path (quick mode, knowledge base) ──
        const r = await fetch('/api/chat/stream', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: userMsg, sessionId, assistantId: selectedAsst }),
        })
        if (!r.ok || !r.body) {
          const d = await r.json().catch(() => ({}))
          const errMsg: Message = { role: 'assistant', content: `错误: ${d.error || '请求失败'}` }
          const updated = [...newMessages, errMsg]
          setMessages(updated); persist(convId, updated)
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
      }
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

  function handleSuggest(text: string) {
    setInput(text)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const asstConversations = conversations
    .filter(c => c.assistantId === selectedAsst)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const showWelcome = messages.length === 0

  const deepThinkActive = deepThinkEnabled

  const currentAsstName = assistants.find(a => a.id === selectedAsst)?.name || '智能助手'

  return (
    <>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, position: 'relative', zIndex: 1 }}>

        {/* ── Header ── */}
        <div style={{
          padding: '12px 20px', background: 'rgba(255,255,255,.85)',
          backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(59,130,246,.1)',
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>AI 问答</h1>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>基于知识库的智能问答助手</p>
          </div>
          {/* Assistant selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>助手:</span>
            {assistants.map(a => (
              <button key={a.id} onClick={() => setSelectedAsst(a.id)}
                style={{
                  padding: '4px 11px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                  background: selectedAsst === a.id ? '#2563eb' : 'var(--bg-elevated)',
                  color: selectedAsst === a.id ? '#fff' : 'var(--text-primary)',
                  border: selectedAsst === a.id ? '1.5px solid #2563eb' : '1px solid var(--border-strong)',
                }}>
                {a.name}
              </button>
            ))}
            {assistants.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>加载中...</span>}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* ── Main chat column ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

            {/* Messages / Welcome area */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {showWelcome ? (
                <WelcomeScreen
                  assistantName={currentAsstName}
                  onSuggest={handleSuggest}
                  fileCount={fileCount}
                  initMsg={initMsg}
                />
              ) : (
                <div style={{ padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {messages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', animation: 'fadeInUp 0.25s ease both' }}>
                      <div style={{ maxWidth: '82%', width: msg.role === 'user' ? 'auto' : '100%' }}>
                        {msg.role === 'assistant' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                            <div style={{
                              width: 24, height: 24, borderRadius: 10, flexShrink: 0,
                              background: 'linear-gradient(135deg, #2563eb, #60a5fa)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, color: 'var(--bg-surface)', fontWeight: 700,
                            }}>AI</div>
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{currentAsstName}</span>
                          </div>
                        )}
                        <div style={{
                          borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                          padding: '10px 14px', wordBreak: 'break-word', lineHeight: 1.6,
                          background: msg.role === 'user'
                            ? 'linear-gradient(135deg, #2563eb, #3b82f6)'
                            : 'var(--bg-elevated)',
                          color: msg.role === 'user' ? '#fff' : 'var(--text-primary)', fontSize: 14,
                          border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                          boxShadow: msg.role === 'user'
                            ? '0 2px 12px rgba(37,99,235,0.2)'
                            : '0 1px 4px rgba(0,0,0,0.04)',
                        }}>
                          {msg.role === 'user' ? (
                            <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                          ) : msg.streaming && msg.content === '' ? (
                            <ThinkingIndicator elapsed={elapsed} webSearch={webSearchEnabled} />
                          ) : (
                            <MarkdownText text={msg.content} />
                          )}
                        </div>
                        {!msg.streaming && msg.role === 'assistant' && msg.content && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
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
                        {msg.webRefs && msg.webRefs.length > 0 && <WebRefList refs={msg.webRefs} />}
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* ── Input area (always at bottom) ── */}
            <div style={{ flexShrink: 0, padding: '8px 16px 16px' }}>
              <div
                style={{
                  background: 'var(--bg-surface)', borderRadius: 16,
                  border: '1px solid var(--border-strong)',
                  boxShadow: '0 2px 12px rgba(59,130,246,0.06)',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 4px rgba(59,130,246,0.1), 0 2px 12px rgba(59,130,246,0.08)' }}
                onBlurCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(59,130,246,0.06)' }}
              >
                <textarea
                  ref={textareaRef} value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={sessionId ? '输入问题... (Enter 发送，Shift+Enter 换行)' : '会话初始化中...'}
                  disabled={!sessionId || loading}
                  rows={1}
                  style={{
                    width: '100%', resize: 'none', fontSize: 14, color: 'var(--text-primary)',
                    border: 'none', borderRadius: '14px 14px 0 0',
                    padding: '14px 16px 8px', outline: 'none',
                    minHeight: 52, maxHeight: 160, overflowY: 'auto',
                    background: 'transparent',
                    cursor: (!sessionId || loading) ? 'not-allowed' : 'auto',
                    fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box',
                  }}
                />
                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 10px 10px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {/* 深度思考 button */}
                    <button
                      onClick={toggleDeepThink}
                      title={deepThinkActive ? '深度推理已开启，点击切回快速模式' : '切换到深度推理模式 · DeepSeek V4 Flash'}
                      style={{
                        padding: '5px 11px', borderRadius: 10, fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.2s',
                        border: deepThinkActive ? '1px solid #7c3aed' : '1px solid var(--border)',
                        background: deepThinkActive ? 'rgba(124,58,237,0.08)' : 'transparent',
                        color: deepThinkActive ? '#7c3aed' : 'var(--text-secondary)',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; if (!deepThinkActive) { el.style.borderColor = '#c4b5fd'; el.style.color = '#7c3aed'; el.style.background = 'rgba(124,58,237,0.05)' } }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; if (!deepThinkActive) { el.style.borderColor = '#e2e8f0'; el.style.color = '#64748b'; el.style.background = 'transparent' } }}
                    >
                      <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      深度思考
                    </button>

                    {/* 联网搜索 button */}
                    <button
                      onClick={() => setWebSearchEnabled(e => !e)}
                      title={webSearchEnabled ? '联网搜索已开启，点击关闭' : '开启联网搜索'}
                      style={{
                        padding: '5px 11px', borderRadius: 10, fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.2s',
                        border: webSearchEnabled ? '1px solid #0ea5e9' : '1px solid var(--border)',
                        background: webSearchEnabled ? 'rgba(14,165,233,0.08)' : 'transparent',
                        color: webSearchEnabled ? '#0284c7' : 'var(--text-secondary)',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; if (!webSearchEnabled) { el.style.borderColor = '#7dd3fc'; el.style.color = '#0284c7'; el.style.background = 'rgba(14,165,233,0.05)' } }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; if (!webSearchEnabled) { el.style.borderColor = '#e2e8f0'; el.style.color = '#64748b'; el.style.background = 'transparent' } }}
                    >
                      {/* Globe / Internet icon */}
                      <svg style={{ width: 13, height: 13 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" strokeWidth={1.8}/>
                        <line x1="2" y1="12" x2="22" y2="12" strokeWidth={1.8}/>
                        <path strokeLinecap="round" strokeWidth={1.8} d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                      </svg>
                      联网搜索
                    </button>
                  </div>

                  {/* Send button */}
                  <button onClick={handleSend} disabled={!input.trim() || !sessionId || loading}
                    title="发送 (Enter)"
                    style={{
                      width: 36, height: 36, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
                      background: (!input.trim() || !sessionId || loading) ? '#e2e8f0' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
                      color: (!input.trim() || !sessionId || loading) ? '#94a3b8' : 'var(--bg-surface)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                      boxShadow: (!input.trim() || !sessionId || loading) ? 'none' : '0 2px 10px rgba(37,99,235,0.3)',
                    }}
                    onMouseEnter={e => { if (input.trim() && sessionId && !loading) { const el = e.currentTarget as HTMLElement; el.style.transform = 'scale(1.08)'; el.style.boxShadow = '0 4px 16px rgba(37,99,235,0.4)' } }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'scale(1)'; el.style.boxShadow = (!input.trim() || !sessionId || loading) ? 'none' : '0 2px 10px rgba(37,99,235,0.3)' }}>
                    {loading
                      ? <svg style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z" /></svg>
                      : <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" /></svg>
                    }
                  </button>
                </div>
              </div>

              {/* Mode indicator */}
              {(deepThinkActive || webSearchEnabled) && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'center' }}>
                  {deepThinkActive && (
                    <span style={{ fontSize: 11, color: '#7c3aed', background: 'rgba(124,58,237,0.07)', padding: '2px 8px', borderRadius: 12, border: '1px solid rgba(124,58,237,0.15)' }}>
                      🔮 深度思考已开启 · DeepSeek V4 Flash
                    </span>
                  )}
                  {webSearchEnabled && (
                    <span style={{ fontSize: 11, color: '#0284c7', background: 'rgba(14,165,233,0.07)', padding: '2px 8px', borderRadius: 12, border: '1px solid rgba(14,165,233,0.15)' }}>
                      🌐 联网搜索已开启
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── History panel ── */}
          <div style={{ width: 236, flexShrink: 0, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>历史对话</span>
              <button onClick={() => startNewConversation(selectedAsst)}
                style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eff6ff'; (e.currentTarget as HTMLElement).style.borderColor = '#93c5fd' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0' }}>
                <svg style={{ width: 11, height: 11 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                新建
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '5px 6px' }}>
              {asstConversations.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12, padding: '28px 0' }}>暂无对话记录</div>
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
                      padding: '8px 9px', borderRadius: 10, marginBottom: 2, cursor: 'pointer',
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
                        style={{ width: '100%', fontSize: 12, border: '1.5px solid #3b82f6', borderRadius: 5, padding: '2px 6px', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-surface)' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? '#1d4ed8' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                            {conv.name}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                            {dateStr} · {conv.messages.length > 0 ? `${Math.floor(conv.messages.length / 2)} 轮` : '空白'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 1, flexShrink: 0, opacity: 0, transition: 'opacity 0.1s' }} className="hov-actions">
                          <button onClick={e => { e.stopPropagation(); startEditName(conv) }}
                            title="重命名"
                            style={{ padding: '2px 5px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4, color: 'var(--text-tertiary)', fontSize: 11, lineHeight: 1 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e0f2fe'; (e.currentTarget as HTMLElement).style.color = '#0284c7' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}>
                            ✎
                          </button>
                          <button onClick={e => { e.stopPropagation(); if (confirm('删除此对话？')) deleteConversation(conv.id) }}
                            title="删除"
                            style={{ padding: '2px 5px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4, color: 'var(--text-tertiary)', fontSize: 11, lineHeight: 1 }}
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
          <div style={{ background: 'rgba(15,23,42,0.82)', color: 'var(--bg-surface)', fontSize: 14, fontWeight: 500, padding: '10px 22px', borderRadius: 12, backdropFilter: 'blur(4px)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            已复制
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes floatLogo { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        div:hover > .hov-actions,
        div:hover .hov-actions { opacity: 1 !important; }
      `}</style>
    </>
  )
}
