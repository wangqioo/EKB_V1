import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

const RAGFLOW_BASE = process.env.RAGFLOW_BASE_URL || 'http://localhost:8085'
const API_KEY = process.env.RAGFLOW_API_KEY || 'ragflow-admin-api-key-2026'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() || ''
  const datasetIds = req.nextUrl.searchParams.get('datasetIds') || ''

  if (!q) return NextResponse.json({ chunks: [], total: 0 })

  // Fetch all datasets if none specified
  let ids: string[] = datasetIds ? datasetIds.split(',').filter(Boolean) : []
  if (ids.length === 0) {
    try {
      const r = await fetch(`${RAGFLOW_BASE}/api/v1/datasets?page=1&page_size=100`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      })
      const d = await r.json()
      ids = (d.data || []).map((ds: { id: string }) => ds.id)
    } catch {
      return NextResponse.json({ chunks: [], total: 0, error: '无法获取知识库列表' })
    }
  }

  if (ids.length === 0) return NextResponse.json({ chunks: [], total: 0 })

  try {
    const r = await fetch(`${RAGFLOW_BASE}/api/v1/retrieval`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: q,
        dataset_ids: ids,
        page: 1,
        page_size: 10,
        similarity_threshold: 0.1,
        vector_similarity_weight: 0.3,
        top_k: 1024,
        rerank_id: '',
        keyword: false,
        highlight: true,
      }),
      signal: AbortSignal.timeout(15000),
    })
    const d = await r.json()
    const chunks = (d.data?.chunks || []).map((c: {
      id: string; document_id: string; document_keyword: string;
      dataset_id: string; content_with_weight: string; similarity: number
      term_similarity?: number; vector_similarity?: number
    }) => ({
      id: c.id,
      docId: c.document_id,
      docName: c.document_keyword,
      datasetId: c.dataset_id,
      content: c.content_with_weight,
      similarity: c.similarity,
      termSimilarity: c.term_similarity,
      vectorSimilarity: c.vector_similarity,
    }))
    return NextResponse.json({ chunks, total: chunks.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '检索失败'
    return NextResponse.json({ chunks: [], total: 0, error: msg })
  }
}
