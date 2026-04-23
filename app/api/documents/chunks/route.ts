import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

const RAGFLOW_BASE = process.env.RAGFLOW_BASE_URL || 'http://localhost:8085'
const API_KEY = process.env.RAGFLOW_API_KEY || 'ragflow-admin-api-key-2026'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const datasetId = req.nextUrl.searchParams.get('datasetId')
  const docId = req.nextUrl.searchParams.get('docId')
  if (!datasetId || !docId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const r = await fetch(
    `${RAGFLOW_BASE}/api/v1/datasets/${datasetId}/documents/${docId}/chunks?page=1&page_size=100`,
    { headers: { 'Authorization': `Bearer ${API_KEY}` } }
  )
  const d = await r.json()
  return NextResponse.json(d)
}
