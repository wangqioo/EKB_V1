import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function SOPPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#eef2fb', position: 'relative' }}>
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <div className="aurora aurora-3" />
      <Sidebar userName={session.name} role={session.role} permissionLevel={session.permissionLevel ?? 0} />
      <div style={{ flex: 1, overflow: 'auto', padding: '40px 48px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 800 }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>企业知识库平台 — 使用指南</h1>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>SOP 流程化展示 · 帮助您快速上手平台各功能</p>
          </div>

          {[
            {
              step: '01', title: '登录与权限说明', color: '#2563eb', bg: '#dbeafe',
              items: [
                '访问平台后，使用管理员分配的账号密码登录',
                '基础权限：可浏览知识库、参与 AI 问答、查看学习培训',
                '中级权限：额外拥有文件上传、资源收藏管理、下载机密文件权限',
                '最高权限（管理员）：完全控制，包括用户管理、删除/恢复文件、课程管理',
              ],
            },
            {
              step: '02', title: '知识库管理', color: '#7c3aed', bg: '#f3e8ff',
              items: [
                '左侧导航点击「知识库」进入文件管理页面',
                '顶部 Tab 切换不同知识库（如：协会知识库、技术文档）',
                '拖拽文件到上传区域或点击选择文件进行上传，需填写所属部门、文件类型',
                '机密文件请勾选「机密」，仅中级及以上权限用户可下载',
                '文件列表中点击文件名可预览内容，点击下载图标下载',
                '拖拽文件到文件夹图标可将文件归类',
                '在筛选栏通过部门、类型快速找到所需文件',
              ],
            },
            {
              step: '03', title: 'AI 问答使用', color: '#d97706', bg: '#fef9c3',
              items: [
                '点击左侧导航「AI 问答」进入智能问答页面',
                '选择对应的 AI 助手（不同助手对应不同知识库）',
                '在输入框输入问题，按 Enter 发送（Shift+Enter 换行）',
                'AI 会从知识库中检索相关内容并给出回答，检索较复杂时需等待约 10-30 秒',
                '点击「重置会话」开始新的对话',
              ],
            },
            {
              step: '04', title: '学习培训', color: '#16a34a', bg: '#dcfce7',
              items: [
                '点击左侧「学习培训」查看企业内部课程列表',
                '课程卡片显示当前学习状态：待学习 / 已学习 / 通过学习测验',
                '点击「开始学习」阅读课程内容，系统自动标记为已学习',
                '学习完成后可点击「开始测验」参与知识测验，60分及以上视为通过',
                '管理员可在右上角「新增课程」添加培训内容和测验题目',
              ],
            },
            {
              step: '05', title: '资源收藏（Linkbox）', color: '#0891b2', bg: '#e0f2fe',
              items: [
                '点击左侧「资源收藏」管理链接、图片、文字、备注等资源',
                '支持类型：链接（网址收藏）、图片（图片URL）、文字（文本内容）、备注',
                '可添加「AI 简介」字段，一句话说明资源用途',
                '使用顶部类型筛选器快速找到特定类型的资源',
              ],
            },
            {
              step: '06', title: '文件版本管理（管理员）', color: '#dc2626', bg: '#fee2e2',
              items: [
                '管理员删除文件时执行软删除，文件进入回收站而非直接清除',
                '点击文件列表底部「回收站」按钮查看已删除文件',
                '在回收站可「恢复」文件（重新显示）或「永久删除」（从知识库彻底清除）',
                '此功能用于防止误删除，确保重要文件可恢复',
              ],
            },
          ].map(section => (
            <div key={section.step} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '24px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: section.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: section.color }}>{section.step}</span>
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>{section.title}</h2>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {section.items.map((item, i) => (
                  <li key={i} style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>{item}</li>
                ))}
              </ul>
            </div>
          ))}

          <div style={{ background: '#0f172a', borderRadius: 14, padding: '24px', color: '#94a3b8' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', margin: '0 0 12px' }}>常见问题</h3>
            {[
              ['AI 回答很慢怎么办？', '知识库使用 RAPTOR/GraphRAG 深度检索，首次查询可能需要 15-30 秒。系统会显示等待提示，请耐心等待。'],
              ['上传文件后看不到内容？', '文件上传后需要解析才能被 AI 检索。点击文件旁的「解析」按钮触发解析，状态变为「已完成」后即可正常使用。'],
              ['忘记密码怎么办？', '请联系管理员重置密码。管理员可在「用户管理」页面进行操作。'],
            ].map(([q, a], i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>Q: {q}</div>
                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>A: {a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
