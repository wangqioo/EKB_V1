import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createSession, getAssistants } from '@/lib/ragflow'

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const assistants = await getAssistants()
    return NextResponse.json({ data: assistants })
  } catch (e) {
    console.error('[GET /api/chat/session]', e)
    return NextResponse.json({ data: [], error: String(e) })
  }
}

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { assistantId } = await req.json()
    if (!assistantId) return NextResponse.json({ error: '缺少 assistantId' }, { status: 400 })
    const session = await createSession(assistantId, `${user.name}的对话`)
    if (!session?.id) {
      console.error('[POST /api/chat/session] RAGFlow returned no session id', session)
      return NextResponse.json({ error: 'RAGFlow 未返回有效会话，请检查助手配置' }, { status: 500 })
    }
    return NextResponse.json({ data: session })
  } catch (e) {
    console.error('[POST /api/chat/session]', e)
    return NextResponse.json({ error: '创建会话失败: ' + String(e) }, { status: 500 })
  }
}
