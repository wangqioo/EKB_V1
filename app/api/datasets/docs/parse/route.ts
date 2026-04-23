import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

const RAGFLOW_BASE = process.env.RAGFLOW_BASE_URL || 'http://localhost:8085'
const API_KEY = process.env.RAGFLOW_API_KEY || 'ragflow-admin-api-key-2026'

// POST /api/datasets/docs/parse
// Body: { datasetId: string, docIds: string[] }
export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin' && (user.permissionLevel ?? 0) < 1) {
    return NextResponse.json({ error: '需要中级或以上权限才能触发解析' }, { status: 403 })
  }

  const { datasetId, docIds } = await req.json()
  if (!datasetId || !Array.isArray(docIds) || docIds.length === 0) {
    return NextResponse.json({ error: '参数缺失: datasetId 和 docIds 必填' }, { status: 400 })
  }

  const r = await fetch(
    `${RAGFLOW_BASE}/api/v1/datasets/${datasetId}/chunks`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_ids: docIds }),
    }
  )
  const data = await r.json()
  return NextResponse.json(data)
}
