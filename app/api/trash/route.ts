import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { deleteDocument } from '@/lib/ragflow'
import fs from 'fs'
import path from 'path'

const META_FILE = path.join(process.cwd(), 'data', 'doc_meta.json')

function readMeta(): Record<string, Record<string, unknown>> {
  try { return JSON.parse(fs.readFileSync(META_FILE, 'utf-8')) } catch { return {} }
}
function writeMeta(data: Record<string, Record<string, unknown>>) {
  const dir = path.dirname(META_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(META_FILE, JSON.stringify(data, null, 2))
}

// POST /api/trash { docId }  → soft delete
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { docId } = await req.json()
  if (!docId) return NextResponse.json({ error: '缺少 docId' }, { status: 400 })
  const all = readMeta()
  all[docId] = {
    ...(all[docId] || {}),
    deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: session.name,
  }
  writeMeta(all)
  return NextResponse.json({ ok: true })
}

// PATCH /api/trash { docId }  → restore
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { docId } = await req.json()
  const all = readMeta()
  if (all[docId]) {
    delete all[docId].deleted
    delete all[docId].deleted_at
    delete all[docId].deleted_by
  }
  writeMeta(all)
  return NextResponse.json({ ok: true })
}

// DELETE /api/trash { datasetId, docId }  → hard delete (RAGFlow + meta)
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { datasetId, docId } = await req.json()
  const all = readMeta()
  delete all[docId]
  writeMeta(all)
  await deleteDocument(datasetId, [docId])
  return NextResponse.json({ ok: true })
}
