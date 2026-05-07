import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

const RAGFLOW_BASE = process.env.RAGFLOW_BASE_URL || 'http://localhost:8085'
const API_KEY = process.env.RAGFLOW_API_KEY || 'ragflow-admin-api-key-2026'

const MODEL_MAP: Record<string, string> = {
  qwen: 'deepseek-v4-flash',
  gemma4: 'deepseek-v4-flash',
}

export async function PUT(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { assistantId, model } = await req.json()
  if (!assistantId || !MODEL_MAP[model]) {
    return NextResponse.json({ error: '参数无效' }, { status: 400 })
  }

  try {
    const r = await fetch(`${RAGFLOW_BASE}/api/v1/chats/${assistantId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ llm: { model_name: MODEL_MAP[model] } }),
    })
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      return NextResponse.json({ error: d.message || '切换失败' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, modelName: MODEL_MAP[model] })
  } catch {
    return NextResponse.json({ error: '网络错误' }, { status: 500 })
  }
}
