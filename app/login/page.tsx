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
    <div style={{ minHeight: '100vh', display: 'flex', position: 'relative', zIndex: 1 }}>
      {/* Left branding panel */}
      <div style={{
        display: 'none', flex: '0 0 45%',
        background: 'linear-gradient(150deg, #0f172a 0%, #1e3a5f 60%, #0f172a 100%)',
        flexDirection: 'column', justifyContent: 'space-between', padding: '48px',
      }} className="lg-left-panel">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 60 }}>
            <div style={{ width: 40, height: 40, background: '#3b82f6', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg style={{ width: 22, height: 22 }} fill="none" viewBox="0 0 24 24" stroke="white">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>企业知识库</span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 38, fontWeight: 700, lineHeight: 1.25, marginBottom: 20 }}>
            智能知识管理<br />
            <span style={{ color: '#60a5fa' }}>驱动团队效能</span>
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 16, lineHeight: 1.7 }}>
            基于 AI 的企业级知识库平台，让每一份知识都触手可及，让每一次搜索都精准有效。
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          {[
            { label: '文档管理', desc: '多格式上传' },
            { label: 'AI 问答', desc: '智能检索' },
            { label: '权限管控', desc: '精细管理' },
          ].map(item => (
            <div key={item.label} style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
              <div style={{ color: '#64748b', fontSize: 13 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', background: '#f8fafc' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Mobile logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
            <div style={{ width: 36, height: 36, background: '#3b82f6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg style={{ width: 20, height: 20 }} fill="none" viewBox="0 0 24 24" stroke="white">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>企业知识库</span>
          </div>

          <div style={{ background: '#fff', borderRadius: 20, padding: 32, boxShadow: '0 4px 32px rgba(0,0,0,0.08)' }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
                {mode === 'login' ? '欢迎回来' : '创建账号'}
              </h2>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                {mode === 'login' ? '请登录您的企业账号' : '注册后即可访问知识库'}
              </p>
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 24 }}>
              {(['login', 'register'] as const).map(m => (
                <button key={m} onClick={() => switchMode(m)} style={{
                  flex: 1, padding: '8px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: 500, transition: 'all 0.15s',
                  background: mode === m ? '#fff' : 'transparent',
                  color: mode === m ? '#0f172a' : '#64748b',
                  boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                }}>
                  {m === 'login' ? '登录' : '注册'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {mode === 'register' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>昵称（可选）</label>
                    <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                      placeholder="显示名称，留空则使用用户名"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>用户名</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                    placeholder="请输入用户名" required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>密码</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? '至少6位' : '请输入密码'} required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                {mode === 'register' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>确认密码</label>
                      <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                        placeholder="再次输入密码" required
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <button type="button" onClick={() => setShowAdminKey(!showAdminKey)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#3b82f6', padding: 0 }}>
                        <svg style={{ width: 13, height: 13, transition: 'transform 0.2s', transform: showAdminKey ? 'rotate(90deg)' : 'rotate(0)' }}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        使用管理员密钥注册
                      </button>
                      {showAdminKey && (
                        <input type="text" value={adminKey} onChange={e => setAdminKey(e.target.value)}
                          placeholder="输入管理员密钥" autoComplete="off"
                          style={{ marginTop: 8, width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #fbbf24', background: '#fffbeb', fontSize: 14, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                      )}
                    </div>
                  </>
                )}

                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#dc2626' }}>
                    <svg style={{ width: 15, height: 15, flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} style={{
                  width: '100%', padding: '11px', borderRadius: 9, border: 'none',
                  background: loading ? '#93c5fd' : '#2563eb', color: '#fff',
                  fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                  marginTop: 4,
                }}>
                  {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
                </button>
              </div>
            </form>

            {mode === 'login' && (
              <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#94a3b8' }}>
                默认账号：admin / admin2026
              </p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .lg-left-panel { display: flex !important; }
        }
      `}</style>
    </div>
  )
}

