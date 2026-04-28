import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDatasets, listDocuments, getAssistants } from '@/lib/ragflow'

const RAGFLOW_BASE = process.env.RAGFLOW_BASE_URL || 'http://localhost:8085'
const API_KEY = process.env.RAGFLOW_API_KEY || 'ragflow-admin-api-key-2026'

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || 'list'

  if (action === 'assistants') {
    const assistants = await getAssistants()
    return NextResponse.json({ data: assistants })
  }

  if (action === 'datasets') {
    const datasets = await getDatasets()
    return NextResponse.json({ data: datasets })
  }

  // Default: list all datasets with document counts
  const datasets = await getDatasets()
  const enriched = await Promise.all(datasets.map(async (ds: any) => {
    try {
      const docs = await listDocuments(ds.id)
      return { ...ds, docCount: docs.length }
    } catch {
      return { ...ds, docCount: 0 }
    }
  }))

  return NextResponse.json({ data: enriched })
}

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { question, assistantId } = await req.json()
  if (!question || !assistantId) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 })
  }

  try {
    const r = await fetch(`${RAGFLOW_BASE}/api/v1/chats/${assistantId}/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, session_id: null, stream: false }),
      signal: AbortSignal.timeout(30000),
    })

    if (!r.ok) {
      const txt = await r.text().catch(() => '')
      return NextResponse.json({ error: `RAGFlow错误 ${r.status}: ${txt.slice(0, 200)}` }, { status: 500 })
    }

    const d = await r.json()
    const answer = d.data?.answer || '无结果'
    const references = d.data?.reference || {}

    return NextResponse.json({
      data: {
        answer,
        reference: Object.keys(references).length > 0 ? references : undefined,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '搜索失败'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
