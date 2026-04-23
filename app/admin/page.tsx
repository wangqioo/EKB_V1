'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface User { id: string; name: string; role: string; permissionLevel: number }
const PERM_LABEL = ['基础权限', '中级权限', '最高权限']

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [me, setMe] = useState<{ id: string; name: string; role: string; permissionLevel: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const router = useRouter()

  async function load() {
    const [uRes, mRes] = await Promise.all([fetch('/api/admin/users'), fetch('/api/auth/login', { method: 'GET' }).then(() => null).catch(() => null)])
    if (uRes.status === 403) { router.push('/library'); return }
    const uData = await uRes.json()
    setUsers(uData.users || [])
    // get self from cookie session
    const meRes = await fetch('/api/auth/login')
    // Actually use a different approach - get session from document.cookie parsing or from initial load
    // Let's just get it from the users list after comparing... but we don't have self id
    // Store me from a dedicated endpoint - we'll use the fact that admin is the current user
    setLoading(false)
  }

  useEffect(() => {
    // Get current user from session cookie
    fetch('/api/datasets').then(async r => {
      if (r.status === 401) { router.push('/login'); return }
    })
    fetch('/api/admin/users').then(async r => {
      if (r.status === 403) { router.push('/library'); return }
      const data = await r.json()
      setUsers(data.users || [])
      setLoading(false)
    })
  }, [])

  async function update(userId: string, field: 'role' | 'permissionLevel', value: string | number) {
    setSaving(userId)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, [field === 'role' ? 'role' : 'permissionLevel']: value }),
    })
    const r = await fetch('/api/admin/users')
    const data = await r.json()
    setUsers(data.users || [])
    setSaving(null)
  }

  // We don't have self info here easily, use localStorage trick or just skip self-check for now
  const currentUser = typeof window !== 'undefined' ? null : null

  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', background: '#eef2fb', position: 'relative' }}>
      <Sidebar userName="管理员" role="admin" permissionLevel={2} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 }}>加载中...</div>
    </div>
  )

  const adminCount = users.filter(u => u.role === 'admin').length

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#eef2fb', position: 'relative' }}>
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <div className="aurora aurora-3" />
      <Sidebar userName={users.find(u => u.role === 'admin')?.name || '管理员'} role="admin" permissionLevel={2} />
      <div style={{ flex: 1, overflow: 'auto', padding: '32px 40px', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>用户管理</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>管理企业用户账号与权限</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(140px, 200px))', gap: 14, marginBottom: 28 }}>
          {[
            { label: '全部用户', value: users.length, color: '#3b82f6', bg: '#eff6ff' },
            { label: '管理员', value: adminCount, color: '#f59e0b', bg: '#fffbeb' },
            { label: '普通员工', value: users.length - adminCount, color: '#22c55e', bg: '#f0fdf4' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>用户列表</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['用户', '角色', '权限等级', ''].map(h => (
                  <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #f8fafc' : 'none', opacity: saving === u.id ? 0.6 : 1 }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <td style={{ padding: '13px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: u.role === 'admin' ? '#fef3c7' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: u.role === 'admin' ? '#d97706' : '#2563eb', flexShrink: 0 }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{u.name}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>@{u.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 20px' }}>
                    <select value={u.role} onChange={e => update(u.id, 'role', e.target.value)} disabled={saving === u.id}
                      style={{ fontSize: 13, padding: '5px 10px', borderRadius: 7, border: '1.5px solid #e2e8f0', color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none' }}>
                      <option value="user">普通员工</option>
                      <option value="admin">管理员</option>
                    </select>
                  </td>
                  <td style={{ padding: '13px 20px' }}>
                    <select value={u.permissionLevel} onChange={e => update(u.id, 'permissionLevel', parseInt(e.target.value))} disabled={saving === u.id}
                      style={{ fontSize: 13, padding: '5px 10px', borderRadius: 7, border: '1.5px solid #e2e8f0', color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none' }}>
                      <option value={0}>基础（仅问答）</option>
                      <option value={1}>中级（上传+问答）</option>
                      <option value={2}>最高（全部操作）</option>
                    </select>
                  </td>
                  <td style={{ padding: '13px 20px', fontSize: 12, color: '#94a3b8' }}>
                    {saving === u.id ? '保存中...' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 20, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 20px', fontSize: 13, color: '#64748b', lineHeight: 1.8 }}>
          <strong style={{ color: '#374151' }}>权限说明：</strong>
          基础权限 — 仅可使用 AI 问答；
          中级权限 — 可上传文档 + 问答；
          最高权限 — 可新建知识库 + 上传 + 问答；
          管理员 — 全部操作（删除文档/知识库 + 权限管理）
        </div>
      </div>
    </div>
  )
}
