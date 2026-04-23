'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const PERM = ['基础', '中级', '最高']

interface Props { userName: string; role: string; permissionLevel?: number }

export default function Sidebar({ userName, role, permissionLevel = 0 }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const mainNav = [
    {
      href: '/library', label: '知识库',
      icon: <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    },
    {
      href: '/chat', label: 'AI 问答',
      icon: <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    },
    {
      href: '/linkbox', label: '资源收藏',
      icon: <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>,
    },
    {
      href: '/training', label: '学习培训',
      icon: <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
    },
    {
      href: '/sop', label: 'SOP 指引',
      icon: <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
    },
    {
      href: '/contact', label: '联系运维',
      icon: <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
    },
  ]

  const adminNav = role === 'admin' ? [
    {
      href: '/admin', label: '用户管理',
      icon: <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    },
  ] : []

  const NavItem = ({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) => {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link href={href}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', margin: '1px 8px', borderRadius: 8,
          fontSize: 13, fontWeight: 500,
          textDecoration: 'none', transition: 'all 0.18s',
          position: 'relative',
          background: active ? 'rgba(59,130,246,.18)' : 'transparent',
          color: active ? '#93c5fd' : '#6b8ab8',
          border: active ? '1px solid rgba(59,130,246,.25)' : '1px solid transparent',
        }}
        onMouseEnter={e => {
          if (!active) {
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.07)'
            ;(e.currentTarget as HTMLElement).style.color = '#a8c4e8'
          }
        }}
        onMouseLeave={e => {
          if (!active) {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = '#6b8ab8'
          }
        }}
      >
        {active && (
          <span style={{
            position: 'absolute', left: 0, top: '20%', bottom: '20%',
            width: 3, borderRadius: 999,
            background: 'linear-gradient(180deg,#60a5fa,#818cf8)',
          }} />
        )}
        {icon}
        {label}
      </Link>
    )
  }

  return (
    <div style={{
      width: 220, display: 'flex', flexDirection: 'column',
      background: '#0f2144', color: '#fff', flexShrink: 0, height: '100vh',
      borderRight: '1px solid #1a3360',
      boxShadow: '4px 0 24px rgba(15,33,68,.18)',
      position: 'relative', zIndex: 10,
    }}>
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{
          width: 34, height: 34,
          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
          borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 14px rgba(59,130,246,.4)', flexShrink: 0,
        }}>
          <svg style={{ width: 17, height: 17 }} fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9' }}>企业知识库</div>
          <div style={{ fontSize: 10, color: '#4a6494', marginTop: 1 }}>Knowledge Base</div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '8px 0', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#2d4a7a', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '12px 16px 4px' }}>主要功能</div>
        {mainNav.map(item => <NavItem key={item.href} {...item} />)}
        {adminNav.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#2d4a7a', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '12px 16px 4px', marginTop: 8 }}>管理</div>
            {adminNav.map(item => <NavItem key={item.href} {...item} />)}
          </>
        )}
      </nav>

      <div style={{ padding: '12px 14px 16px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '8px 10px', borderRadius: 10,
          background: 'rgba(255,255,255,.05)',
          border: '1px solid rgba(255,255,255,.08)',
          cursor: 'pointer', transition: 'all .18s',
        }}
          onClick={logout}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.09)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.05)'}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 12, flexShrink: 0,
          }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
            <div style={{ fontSize: 10, color: '#4a6494' }}>
              {role === 'admin' ? '最高权限' : `${PERM[permissionLevel] ?? ''}权限`}
            </div>
          </div>
          <svg style={{ width: 13, height: 13, color: '#4a6494', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
          </svg>
        </div>
      </div>
    </div>
  )
}
