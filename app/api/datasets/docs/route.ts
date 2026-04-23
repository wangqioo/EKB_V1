import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listDocuments, deleteDocument } from '@/lib/ragflow'
import fs from 'fs'
import path from 'path'

const META_FILE = path.join(process.cwd(), 'data', 'doc_meta.json')

function readMeta(): Record<string, Record<string, unknown>> {
  try { return JSON.parse(fs.readFileSync(META_FILE, 'utf-8')) } catch { return {} }
}

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const datasetId = req.nextUrl.searchParams.get('datasetId') || ''
  const showDeleted = req.nextUrl.searchParams.get('showDeleted') === 'true'
  const docs = await listDocuments(datasetId)
  const meta = readMeta()
  const enriched = docs
    .filter((d: { id: string }) => showDeleted ? meta[d.id]?.deleted === true : meta[d.id]?.deleted !== true)
    .map((d: { id: string }) => ({ ...d, meta: meta[d.id] || {} }))
  return NextResponse.json({ data: enriched })
}

export async function DELETE(req: NextRequest) {
  const user = await getSession()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { datasetId, docIds } = await req.json()
  const result = await deleteDocument(datasetId, docIds)
  return NextResponse.json(result)
}
