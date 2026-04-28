'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

const PERM = ['基础', '中级', '最高']

interface Props { userName: string; role: string; permissionLevel?: number }

// SF Symbol-style SVG icons (outline, 20px, stroke-width 1.5)
const Icons = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  library: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 01-2.5-2.5z"/>
      <path d="M8 7h6M8 11h8"/>
    </svg>
  ),
  search: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7"/>
      <path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  shared: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  ),
  chat: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
  agent: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L9.5 8.5 2 9.5l5.5 5L6 22l6-3.5 6 3.5-1.5-7.5 5.5-5-6-1L12 2z"/>
    </svg>
  ),
  bookmark: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
    </svg>
  ),
  training: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/>
      <path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
  sop: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1.5"/>
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
      <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>
    </svg>
  ),
  contact: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
    </svg>
  ),
  admin: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  logout: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
}

export default function Sidebar({ userName, role, permissionLevel = 0 }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [checkoutCount, setCheckoutCount] = useState(0)

  useEffect(() => {
    function refresh() {
      fetch('/api/shared').then(r => r.json()).then(d => {
        setCheckoutCount((d.docs || []).filter((doc: { status: string }) => doc.status === 'checked_out').length)
      }).catch(() => {})
    }
    refresh()
    const t = setInterval(refresh, 30000)
    return () => clearInterval(t)
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const NavItem = ({
    href, label, icon, badge,
  }: {
    href: string; label: string; icon: React.ReactNode; badge?: number
  }) => {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 14px',
            margin: '1px 10px',
            borderRadius: 'var(--radius)',
            fontSize: 13,
            fontWeight: active ? 600 : 500,
            color: active ? 'var(--accent)' : 'var(--text-secondary)',
            background: active ? 'var(--accent-light)' : 'transparent',
            position: 'relative',
            transition: 'all 0.15s ease',
            cursor: 'pointer',
          }}
          onMouseEnter={e => {
            if (!active) {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'rgba(0,0,0,.04)'
              el.style.color = 'var(--text-primary)'
            }
          }}
          onMouseLeave={e => {
            if (!active) {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'transparent'
              el.style.color = 'var(--text-secondary)'
            }
          }}
        >
          {/* Active indicator bar */}
          {active && (
            <span style={{
              position: 'absolute',
              left: 0, top: '25%', bottom: '25%',
              width: 3,
              borderRadius: 999,
              background: 'var(--accent)',
            }} />
          )}
          <span style={{ opacity: active ? 1 : 0.7 }}>{icon}</span>
          <span style={{ flex: 1 }}>{label}</span>
          {badge !== undefined && badge > 0 && (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 999,
              padding: '1px 7px',
              minWidth: 18,
              textAlign: 'center',
              lineHeight: 1.7,
            }}>
              {badge}
            </span>
          )}
        </div>
      </Link>
    )
  }

  const Divider = () => (
    <div style={{ height: 1, background: 'var(--border)', margin: '6px 16px' }} />
  )

  const GroupLabel = ({ label }: { label: string }) => (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      color: 'var(--text-tertiary)',
      padding: '12px 20px 4px',
    }}>
      {label}
    </div>
  )

  return (
    <div style={{
      width: 230,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-surface)',
      color: 'var(--text-primary)',
      flexShrink: 0,
      height: '100vh',
      borderRight: '1px solid var(--border)',
      position: 'relative',
      zIndex: 10,
    }}>
      {/* macOS window dots */}
      <div className="window-dots">
        <div className="window-dot window-dot-red" />
        <div className="window-dot window-dot-yellow" />
        <div className="window-dot window-dot-green" />
      </div>

      {/* Logo */}
      <Link href="/dashboard" style={{
        padding: '12px 16px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        textDecoration: 'none',
      }}>
        <div style={{
          width: 34,
          height: 34,
          background: 'var(--accent)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,113,227,.3)',
          flexShrink: 0,
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 01-2.5-2.5z"/>
            <path d="M8 7h6M8 11h8"/>
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>企业知识库</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1, fontWeight: 500 }}>Knowledge Base</div>
        </div>
      </Link>

      <nav style={{
        flex: 1,
        padding: '6px 0',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}>
        <NavItem href="/dashboard" label="工作台" icon={Icons.dashboard} />

        <Divider />
        <GroupLabel label="知识管理" />
        <NavItem href="/library" label="知识库" icon={Icons.library} />
        <NavItem href="/search" label="知识检索" icon={Icons.search} />
        <NavItem href="/shared" label="共享文档" icon={Icons.shared} badge={checkoutCount} />

        <Divider />
        <GroupLabel label="协作工具" />
        <NavItem href="/chat" label="AI 问答" icon={Icons.chat} />
        <NavItem href="/agent" label="AI超级智能体" icon={Icons.agent} />
        <NavItem href="/linkbox" label="资源收藏" icon={Icons.bookmark} />

        <Divider />
        <GroupLabel label="学习成长" />
        <NavItem href="/training" label="学习培训" icon={Icons.training} />
        <NavItem href="/sop" label="SOP 指引" icon={Icons.sop} />
        <NavItem href="/contact" label="联系运维" icon={Icons.contact} />

        {role === 'admin' && (
          <>
            <Divider />
            <GroupLabel label="管理" />
            <NavItem href="/admin" label="用户管理" icon={Icons.admin} />
          </>
        )}
      </nav>

      {/* User footer */}
      <div style={{
        padding: '12px 14px 16px',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 'var(--radius)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          transition: 'all .15s ease',
        }}
          onClick={logout}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'rgba(0,0,0,.05)'
            el.style.borderColor = 'var(--border-strong)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'var(--bg-elevated)'
            el.style.borderColor = 'var(--border)'
          }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0071e3, #5856d6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 13,
            color: '#fff',
            flexShrink: 0,
            letterSpacing: 0,
          }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {userName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
              {role === 'admin' ? '最高权限' : `${PERM[permissionLevel] ?? ''}权限`}
            </div>
          </div>
          <span style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>{Icons.logout}</span>
        </div>
      </div>
    </div>
  )
}
