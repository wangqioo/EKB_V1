'use client'
import { useState, useEffect } from 'react'

interface FavItem {
  id: string
  type: 'file' | 'message'
  docId?: string; docName?: string; datasetId?: string; datasetName?: string
  content?: string; conversationName?: string
  savedAt: string; savedBy: string
}

interface Props { userName: string; role: string; permissionLevel: number }

export default function FavoritesClient({ userName, role, permissionLevel }: Props) {
  const [items, setItems] = useState<FavItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'file' | 'message'>('all')
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/favorites').then(r => r.json()).then(d => {
      setItems(d.data || [])
      setLoading(false)
    })
  }, [])

  async function removeFav(id: string) {
    await fetch('/api/favorites', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setItems(prev => prev.filter(i => i.id !== id))
    setMsg('已取消收藏')
    setTimeout(() => setMsg(''), 2000)
  }

  const filtered = items
    .filter(i => filterType === 'all' || i.type === filterType)
    .filter(i => {
      if (!search) return true
      const q = search.toLowerCase()
      return (i.docName || '').toLowerCase().includes(q) ||
             (i.content || '').toLowerCase().includes(q) ||
             (i.conversationName || '').toLowerCase().includes(q)
    })

  const fileCount = items.filter(i => i.type === 'file').length
  const msgCount = items.filter(i => i.type === 'message').length

  return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ padding: '20px 28px 16px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: 19, fontWeight: 700, color: '#0f172a', margin: 0 }}>资源收藏</h1>
              <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0 0' }}>
                共 {items.length} 条收藏 · {fileCount} 个文件 · {msgCount} 条回答
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <svg style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#94a3b8', pointerEvents: 'none' }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
                </svg>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="搜索收藏..."
                  style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 12, color: '#374151', outline: 'none', width: 180 }} />
              </div>
              {/* Filter tabs */}
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, gap: 2 }}>
                {([['all', '全部'], ['file', '📄 文件'], ['message', '💬 回答']] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setFilterType(v)}
                    style={{ padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      background: filterType === v ? '#fff' : 'transparent',
                      color: filterType === v ? '#0f172a' : '#64748b',
                      boxShadow: filterType === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {msg && <p style={{ fontSize: 12, color: '#16a34a', margin: '8px 0 0' }}>{msg}</p>}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px' }}>
          {loading && <div style={{ textAlign: 'center', color: '#94a3b8', padding: '60px 0', fontSize: 14 }}>加载中...</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>
              <p style={{ color: '#475569', fontWeight: 500, fontSize: 14, margin: '0 0 4px' }}>
                {search ? '没有匹配的收藏' : '暂无收藏'}
              </p>
              <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>
                在知识库或 AI 问答中点击 ☆ 收藏内容
              </p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(item => (
              <div key={item.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Icon */}
                <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  background: item.type === 'file' ? '#dbeafe' : '#f0fdf4' }}>
                  {item.type === 'file' ? '📄' : '💬'}
                </div>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {item.type === 'file' ? (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.docName}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, display: 'flex', gap: 8 }}>
                        <span>📚 {item.datasetName || '知识库'}</span>
                        <span>· {new Date(item.savedAt).toLocaleDateString('zh-CN')}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.content}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'flex', gap: 8 }}>
                        <span>💬 {item.conversationName}</span>
                        <span>· {new Date(item.savedAt).toLocaleDateString('zh-CN')}</span>
                      </div>
                    </>
                  )}
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {item.type === 'file' && (
                    <a href={`/library`}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 11, fontWeight: 500, cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                      查看
                    </a>
                  )}
                  <button onClick={() => removeFav(item.id)}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1.5px solid #fca5a5', background: '#fff', color: '#ef4444', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                    取消收藏
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
  )
}
