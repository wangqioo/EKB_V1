'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [adminKey, setAdminKey] = useState('')
  const [showAdminKey, setShowAdminKey] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function switchMode(m: Mode) {
    setMode(m); setError('')
    setUsername(''); setPassword(''); setDisplayName(''); setConfirmPwd('')
    setAdminKey(''); setShowAdminKey(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (mode === 'register') {
      if (password !== confirmPwd) { setError('两次密码不一致'); return }
      if (password.length < 6) { setError('密码至少6位'); return }
    }
    setLoading(true)
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const body = mode === 'login'
      ? { username, password }
      : { username, password, name: displayName || username, ...(adminKey ? { adminKey } : {}) }
    const res = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.ok) {
      router.push('/library')
    } else {
      setError(data.error || (mode === 'login' ? '用户名或密码错误' : '注册失败'))
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      padding: '24px',
    }}>
      {/* macOS window chrome */}
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xl)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        animation: 'scaleIn 0.25s cubic-bezier(.34,1.56,.64,1) both',
      }}>
        {/* Window title bar */}
        <div style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
        }}>
          {/* macOS window dots */}
          <div style={{ display: 'flex', gap: 6, alignSelf: 'stretch' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
          </div>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              background: 'var(--accent)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,113,227,.3)',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 01-2.5-2.5z"/>
                <path d="M8 7h6M8 11h8"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>企业知识库</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>Enterprise Knowledge Base</div>
            </div>
          </div>
        </div>

        {/* Form area */}
        <div style={{ padding: '28px 32px 32px' }}>
          {/* Mode toggle */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius)',
            padding: 4,
            marginBottom: 24,
            border: '1px solid var(--border)',
          }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => switchMode(m)} style={{
                flex: 1,
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                transition: 'all 0.15s',
                background: mode === m ? 'var(--bg-surface)' : 'transparent',
                color: mode === m ? 'var(--text-primary)' : 'var(--text-tertiary)',
                boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
              }}>
                {m === 'login' ? '登录' : '注册账号'}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              {mode === 'login' ? '欢迎回来' : '创建账号'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              {mode === 'login' ? '请登录您的企业账号' : '注册后即可访问知识库'}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {mode === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.01em' }}>
                    昵称（可选）
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="显示名称，留空则使用用户名"
                    className="input"
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.01em' }}>
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  required
                  className="input"
                  autoComplete="username"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.01em' }}>
                  密码
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? '至少6位' : '请输入密码'}
                  required
                  className="input"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>

              {mode === 'register' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.01em' }}>
                      确认密码
                    </label>
                    <input
                      type="password"
                      value={confirmPwd}
                      onChange={e => setConfirmPwd(e.target.value)}
                      placeholder="再次输入密码"
                      required
                      className="input"
                      autoComplete="new-password"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdminKey(!showAdminKey)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--accent)',
                      padding: '2px 0',
                      width: 'fit-content',
                    }}
                  >
                    <svg style={{ width: 12, height: 12, transition: 'transform 0.2s', transform: showAdminKey ? 'rotate(90deg)' : 'rotate(0)' }}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    使用管理员密钥注册
                  </button>

                  {showAdminKey && (
                    <input
                      type="text"
                      value={adminKey}
                      onChange={e => setAdminKey(e.target.value)}
                      placeholder="输入管理员密钥"
                      autoComplete="off"
                      className="input"
                      style={{ borderColor: '#fbbf24', background: '#fffbeb' }}
                    />
                  )}
                </>
              )}

              {error && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#ffebe5',
                  borderRadius: 'var(--radius)',
                  padding: '10px 12px',
                  fontSize: 13,
                  color: 'var(--error)',
                  border: '1px solid rgba(255,59,48,.15)',
                }}>
                  <svg style={{ width: 15, height: 15, flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ width: '100%', padding: '11px', fontSize: 14, marginTop: 4, borderRadius: 'var(--radius)' }}
              >
                {loading ? (
                  <span>处理中...</span>
                ) : mode === 'login' ? (
                  '登录'
                ) : (
                  '创建账号'
                )}
              </button>
            </div>
          </form>

          {mode === 'login' && (
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-tertiary)' }}>
              默认账号：admin / admin2026
            </p>
          )}
        </div>
      </div>

      {/* Background text */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        fontSize: 11,
        color: 'var(--text-tertiary)',
        letterSpacing: '0.02em',
      }}>
        © 2026 企业知识库
      </div>
    </div>
  )
}
