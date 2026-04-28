import { NextResponse } from 'next/server'
import { getSession, loadUsers } from '@/lib/auth'
import { loadDocs as loadSharedDocs } from '@/lib/shared'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const RAGFLOW_BASE = process.env.RAGFLOW_BASE_URL || 'http://localhost:8085'
const API_KEY = process.env.RAGFLOW_API_KEY || 'ragflow-admin-api-key-2026'

function loadDocMeta(): Record<string, { dept?: string; type?: string; confidential?: boolean; deleted?: boolean; uploadedBy?: string; uploadedAt?: string }> {
  const p = join(process.cwd(), 'data', 'doc_meta.json')
  if (!existsSync(p)) return {}
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return {} }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const users = loadUsers()
  const sharedDocs = loadSharedDocs()
  const docMeta = loadDocMeta()

  // My checked-out docs
  const myCheckouts = sharedDocs.filter(d => d.checkedOutBy === session.id && d.status === 'checked_out')

  // All checked-out docs count
  const totalCheckedOut = sharedDocs.filter(d => d.status === 'checked_out').length

  // Fetch datasets + docs from RAGFlow
  let datasets: { id: string; name: string; document_count?: number }[] = []
  let totalDocs = 0
  let todayDocs = 0
  let recentDocs: { id: string; name: string; datasetId: string; datasetName: string; create_date?: string; dept?: string; type?: string; uploadedBy?: string }[] = []

  try {
    // Single RAGFlow call — datasets already include document_count
    const dsRes = await fetch(`${RAGFLOW_BASE}/api/v1/datasets?page=1&page_size=100`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal: AbortSignal.timeout(5000),
    })
    const dsData = await dsRes.json()
    datasets = dsData.data || []

    // Use document_count directly — no per-dataset doc fetches
    totalDocs = datasets.reduce((sum: number, ds: { document_count?: number }) => sum + (ds.document_count ?? 0), 0)

    // Fetch recent docs for ONE dataset only (parallel with a short timeout), non-blocking
    const today = new Date().toISOString().slice(0, 10)
    if (datasets.length > 0) {
      try {
        const docRes = await fetch(
          `${RAGFLOW_BASE}/api/v1/datasets/${datasets[0].id}/documents?page=1&page_size=20`,
          { headers: { Authorization: `Bearer ${API_KEY}` }, signal: AbortSignal.timeout(3000) }
        )
        const docData = await docRes.json()
        const docs = docData.data?.docs || []
        todayDocs = docs.filter((d: { create_date?: string }) => d.create_date?.startsWith(today)).length
        recentDocs = docs.slice(0, 6).map((doc: { id: string; name: string; create_date?: string }) => {
          const meta = docMeta[doc.id] || {}
          return {
            id: doc.id, name: doc.name,
            datasetId: datasets[0].id, datasetName: datasets[0].name,
            create_date: doc.create_date,
            dept: meta.dept, type: meta.type, uploadedBy: meta.uploadedBy,
          }
        }).filter((d: { id: string }) => !docMeta[d.id]?.deleted)
      } catch {}
    }
  } catch {}

  return NextResponse.json({
    user: { id: session.id, name: session.name, role: session.role, permissionLevel: session.permissionLevel },
    stats: {
      totalUsers: Object.keys(users).length,
      totalDocs,
      todayDocs,
      totalDatasets: datasets.length,
      totalShared: sharedDocs.length,
      checkedOut: totalCheckedOut,
    },
    myCheckouts: myCheckouts.map(d => ({
      id: d.id, title: d.title, currentVersion: d.currentVersion, checkedOutAt: d.checkedOutAt,
    })),
    datasets: datasets.slice(0, 6).map(ds => ({
      id: ds.id, name: ds.name, documentCount: ds.document_count ?? 0,
    })),
    recentDocs,
  })
}
