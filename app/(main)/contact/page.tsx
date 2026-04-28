import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function ContactPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
      <div style={{ flex: 1, overflow: 'auto', padding: '40px 48px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 640 }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>联系运维</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>遇到技术问题请通过以下方式联系运维团队</p>
          </div>

          {/* Main contact card */}
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', padding: '32px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{ width: 56, height: 56, background: '#dbeafe', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg style={{ width: 28, height: 28, color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>运维热线</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>198 5162 2265</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: '服务时间', value: '工作日 09:00 – 18:00' },
                { label: '紧急响应', value: '重要问题可随时拨打' },
                { label: '平台运维', value: '企业知识库系统' },
                { label: '服务器', value: 'spark2 (spark-0138)' },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Support scope */}
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', padding: '24px', marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>运维支持范围</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: '🔧', text: '平台访问异常、页面白屏或报错' },
                { icon: '📁', text: '文件上传失败、知识库同步问题' },
                { icon: '🤖', text: 'AI 问答服务异常、RAGFlow 故障' },
                { icon: '👤', text: '账号权限调整、密码重置' },
                { icon: '🌐', text: '网络访问、内网穿透隧道问题' },
                { icon: '💾', text: '数据备份、重要文件恢复' },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 10 }}>
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          <div style={{ background: '#fffbeb', borderRadius: 14, border: '1px solid #fde68a', padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.7 }}>
                非工作时间紧急问题可发送短信说明情况，运维人员会尽快响应。请在联系时说明：
                <strong>所在部门、问题描述、发生时间</strong>，以便快速定位和解决。
              </div>
            </div>
          </div>
        </div>
      </div>
  )
}
