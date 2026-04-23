import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'

const RAGFLOW_BASE = process.env.RAGFLOW_BASE_URL || 'http://localhost:8085'
const API_KEY = process.env.RAGFLOW_API_KEY || 'ragflow-admin-api-key-2026'
const STREAM_TIMEOUT_MS = 180_000 // 3 minutes for RAPTOR+GraphRAG

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { question, sessionId, assistantId } = await req.json()

  let ragRes: Response
  try {
    ragRes = await fetch(`${RAGFLOW_BASE}/api/v1/chats/${assistantId}/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, session_id: sessionId, stream: true }),
      signal: AbortSignal.timeout(STREAM_TIMEOUT_MS),
    })
  } catch (err: unknown) {
    const msg = (err instanceof Error && err.name === 'TimeoutError')
      ? '知识库检索超时（超过3分钟），请稍后重试。'
      : '连接知识库失败，请检查服务状态。'
    return new Response(
      `data: ${JSON.stringify({ data: { answer: msg, final: true, reference: {} } })}\n\ndata: true\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } }
    )
  }

  return new Response(ragRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
