'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface DashboardData {
  user: { id: string; name: string; role: string; permissionLevel: number }
  stats: { totalUsers: number; totalDocs: number; todayDocs: number; totalDatasets: number; totalShared: number; checkedOut: number }
  myCheckouts: { id: string; title: string; currentVersion: number; checkedOutAt: string }[]
  datasets: { id: string; name: string; documentCount: number }[]
  recentDocs: { id: string; name: string; datasetId: string; datasetName: string; create_date?: string; dept?: string; type?: string; uploadedBy?: string }[]
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return { bg: '#fee2e2', color: '#dc2626', label: 'PDF' }
  if (['doc', 'docx'].includes(ext)) return { bg: '#dbeafe', color: '#2563eb', label: 'DOC' }
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { bg: '#dcfce7', color: '#16a34a', label: 'XLS' }
  if (['ppt', 'pptx'].includes(ext)) return { bg: '#ffedd5', color: '#ea580c', label: 'PPT' }
  if (['md', 'txt'].includes(ext)) return { bg: '#f3e8ff', color: '#7c3aed', label: 'TXT' }
  return { bg: '#f1f5f9', color: '#64748b', label: ext.toUpperCase().slice(0, 3) || 'FILE' }
}

function fmtDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(s: string) {
  const diff = Date.now() - new Date(s).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

const greet = () => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

// Apple-style SVG icons for quick actions
const QuickActionIcons = {
  upload: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  search: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  chat: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
  shared: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  ),
  training: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/>
      <path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
}

const quickActions = [
  { href: '/library', icon: QuickActionIcons.upload, label: '上传文档', color: '#0071e3', bg: '#f5f9ff' },
  { href: '/search', icon: QuickActionIcons.search, label: '知识检索', color: '#0071e3', bg: '#f5f9ff' },
  { href: '/chat', icon: QuickActionIcons.chat, label: 'AI 问答', color: '#0071e3', bg: '#f5f9ff' },
  { href: '/shared', icon: QuickActionIcons.shared, label: '共享文档', color: '#0071e3', bg: '#f5f9ff' },
  { href: '/training', icon: QuickActionIcons.training, label: '学习培训', color: '#0071e3', bg: '#f5f9ff' },
]

interface Props { userName: string; role: string; permissionLevel: number }

export default function DashboardClient({ userName, role, permissionLevel }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(d => { setData(d); setLoading(false) })
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  return (
    <div style={{ flex: 1, overflow: 'auto', position: 'relative', zIndex: 1, background: 'var(--bg-base)' }}>

      {/* Sticky top bar */}
      <div style={{
        padding: '20px 32px',
        background: 'rgba(255,255,255,.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 4,
            height: 20,
            background: 'var(--accent)',
            borderRadius: 999,
          }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            工作台
          </span>
        </div>
        {data?.myCheckouts && data.myCheckouts.length > 0 && (
          <Link href="/shared" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 'var(--radius)',
            textDecoration: 'none',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fef9c3'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fffbeb'}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#d97706' }}>
              {data.myCheckouts.length} 份文档待签入
            </span>
            <svg style={{ width: 12, height: 12, color: '#d97706' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>

      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Welcome card */}
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 28px 24px',
          boxShadow: 'var(--shadow)',
          border: '1px solid var(--border)',
          animation: 'fadeUp 0.3s ease-out both',
        }}>
          <h1 style={{
            fontSize: 26,
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0 0 6px',
            letterSpacing: '-0.025em',
          }}>
            {greet()}，{userName}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{dateStr}</p>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          {loading ? Array(5).fill(null).map((_, i) => (
            <div key={i} style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              padding: '20px',
              height: 100,
              animation: 'pulse 1.5s infinite',
            }} />
          )) : [
            { label: '知识库文档', value: data!.stats.totalDocs, sub: `今日 +${data!.stats.todayDocs}`, accent: '#0071e3' },
            { label: '知识库数量', value: data!.stats.totalDatasets, sub: '企业知识资产', accent: '#5856d6' },
            { label: '共享文档', value: data!.stats.totalShared, sub: `${data!.stats.checkedOut} 份签出中`, accent: '#34c759' },
            { label: '团队成员', value: data!.stats.totalUsers, sub: '已注册账号', accent: '#0071e3' },
            { label: '今日新增', value: data!.stats.todayDocs, sub: new Date().toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }), accent: '#ff9f0a' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              padding: '20px 18px 18px',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.2s ease',
              cursor: 'default',
            }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.boxShadow = 'var(--shadow-lg)'
                el.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.boxShadow = 'var(--shadow-sm)'
                el.style.transform = 'translateY(0)'
              }}>
              <div className="stat-number" style={{ color: s.accent }}>{s.value}</div>
              <div className="stat-label" style={{ fontWeight: 600 }}>{s.label}</div>
              <div className="stat-label" style={{ fontSize: 11, marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Checkout alert */}
        {!loading && data!.myCheckouts.length > 0 && (
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid #fde68a',
            padding: '16px 20px',
            boxShadow: 'var(--shadow-sm)',
            animation: 'fadeUp 0.3s ease-out both',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff9f0a' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>待签入文档</span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {data!.myCheckouts.map(doc => (
                <Link key={doc.id} href="/shared" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 14px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  fontSize: 13,
                }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'var(--border-strong)'
                    el.style.background = 'var(--bg-surface)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'var(--border)'
                    el.style.background = 'var(--bg-elevated)'
                  }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{doc.title}</span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 999,
                    background: '#fffbeb',
                    color: '#d97706',
                  }}>V{doc.currentVersion}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{timeAgo(doc.checkedOutAt!)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-secondary)',
            marginBottom: 12,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            paddingLeft: 4,
          }}>
            快捷操作
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {quickActions.map(a => (
              <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: '16px 20px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.2s ease',
                  minWidth: 88,
                }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.boxShadow = 'var(--shadow)'
                    el.style.transform = 'translateY(-2px)'
                    el.style.borderColor = 'var(--accent)'
                    el.style.color = 'var(--accent)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.boxShadow = 'var(--shadow-sm)'
                    el.style.transform = 'translateY(0)'
                    el.style.borderColor = 'var(--border)'
                    el.style.color = 'var(--text-secondary)'
                  }}>
                  <div style={{ color: 'var(--accent)', opacity: 0.85 }}>{a.icon}</div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{a.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Two-column bottom */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Recent docs */}
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
            animation: 'fadeUp 0.3s ease-out both',
            animationDelay: '0.05s',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>最近上传</span>
              <Link href="/library" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                查看全部
              </Link>
            </div>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>加载中...</div>
            ) : data!.recentDocs.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                暂无文档，去上传第一份
              </div>
            ) : data!.recentDocs.map((doc, i) => {
              const fi = getFileIcon(doc.name)
              return (
                <div key={doc.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 20px',
                  borderBottom: i < data!.recentDocs.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.12s ease',
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div style={{
                    width: 30,
                    height: 30,
                    background: fi.bg,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: fi.color, letterSpacing: '0.02em' }}>{fi.label}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>{doc.name}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{doc.datasetName}</span>
                      {doc.dept && (
                        <span style={{
                          fontSize: 10,
                          padding: '0 6px',
                          borderRadius: 999,
                          background: 'var(--accent-light)',
                          color: 'var(--accent)',
                          fontWeight: 600,
                        }}>{doc.dept}</span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{fmtDate(doc.create_date)}</span>
                </div>
              )
            })}
          </div>

          {/* Knowledge bases */}
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
            animation: 'fadeUp 0.3s ease-out both',
            animationDelay: '0.08s',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>知识库状态</span>
              <Link href="/library" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                管理
              </Link>
            </div>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>加载中...</div>
            ) : data!.datasets.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }}>
                  <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 01-2.5-2.5z"/>
                  <path d="M8 7h6M8 11h8"/>
                </svg>
                暂无知识库
              </div>
            ) : data!.datasets.map((ds, i) => {
              const colors = ['#0071e3', '#5856d6', '#34c759', '#ff9f0a', '#ff3b30', '#007aff']
              const c = colors[i % colors.length]
              const maxDocs = Math.max(...data!.datasets.map(d => d.documentCount), 1)
              const pct = Math.round((ds.documentCount / maxDocs) * 100)
              return (
                <div key={ds.id} style={{
                  padding: '13px 20px',
                  borderBottom: i < data!.datasets.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.12s ease',
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{ds.name}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{ds.documentCount} 份</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      background: c,
                      borderRadius: 999,
                      width: `${Math.max(pct, 4)}%`,
                      transition: 'width 0.8s ease',
                      opacity: 0.65,
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
