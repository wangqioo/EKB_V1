import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

const RAGFLOW_BASE = process.env.RAGFLOW_BASE_URL || 'http://localhost:8085'
const API_KEY = process.env.RAGFLOW_API_KEY || 'ragflow-admin-api-key-2026'

// POST /api/datasets/graphrag  { datasetId }  → run graphrag
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
  const { datasetId } = await req.json()
  if (!datasetId) return NextResponse.json({ error: '缺少 datasetId' }, { status: 400 })
  const r = await fetch(`${RAGFLOW_BASE}/api/v1/datasets/${datasetId}/run_graphrag`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
  })
  const data = await r.json()
  return NextResponse.json(data)
}

// GET /api/datasets/graphrag?datasetId=...  → trace progress
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const datasetId = req.nextUrl.searchParams.get('datasetId')
  if (!datasetId) return NextResponse.json({ error: '缺少 datasetId' }, { status: 400 })
  const r = await fetch(`${RAGFLOW_BASE}/api/v1/datasets/${datasetId}/trace_graphrag`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  })
  const data = await r.json()
  return NextResponse.json(data)
}
