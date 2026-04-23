import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

const META_FILE = path.join(process.cwd(), 'data', 'doc_meta.json')

export interface DocMeta {
  dept?: string
  type?: string
  confidential?: boolean
  ai_summary?: string
  deleted?: boolean
  deleted_at?: string
  deleted_by?: string
}

function readMeta(): Record<string, DocMeta> {
  try {
    if (!fs.existsSync(META_FILE)) return {}
    return JSON.parse(fs.readFileSync(META_FILE, 'utf-8'))
  } catch { return {} }
}

function writeMeta(data: Record<string, DocMeta>) {
  const dir = path.dirname(META_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(META_FILE, JSON.stringify(data, null, 2))
}

// GET /api/doc-meta?docIds=id1,id2  OR  no param → all
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rawIds = req.nextUrl.searchParams.get('docIds')
  const all = readMeta()
  if (!rawIds) return NextResponse.json({ data: all })
  const ids = rawIds.split(',').filter(Boolean)
  const subset: Record<string, DocMeta> = {}
  for (const id of ids) subset[id] = all[id] || {}
  return NextResponse.json({ data: subset })
}

// POST /api/doc-meta  { docId, dept?, type?, confidential?, ai_summary? }
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { docId, ...fields } = await req.json()
  if (!docId) return NextResponse.json({ error: '缺少 docId' }, { status: 400 })
  const all = readMeta()
  all[docId] = { ...(all[docId] || {}), ...fields }
  writeMeta(all)
  return NextResponse.json({ ok: true })
}

// PATCH /api/doc-meta  { docId, ...updates }
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { docId, ...updates } = await req.json()
  if (!docId) return NextResponse.json({ error: '缺少 docId' }, { status: 400 })
  const all = readMeta()
  all[docId] = { ...(all[docId] || {}), ...updates }
  writeMeta(all)
  return NextResponse.json({ ok: true })
}
