import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const FAV_FILE = path.join(process.cwd(), 'data', 'favorites.json')

export interface FavItem {
  id: string
  type: 'file' | 'message'
  docId?: string; docName?: string; datasetId?: string; datasetName?: string
  content?: string; conversationName?: string
  savedAt: string; savedBy: string
}

function read(): FavItem[] {
  try { return JSON.parse(fs.readFileSync(FAV_FILE, 'utf-8')) } catch { return [] }
}
function write(data: FavItem[]) {
  const dir = path.dirname(FAV_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(FAV_FILE, JSON.stringify(data, null, 2))
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const all = read()
  return NextResponse.json({ data: all.filter(f => f.savedBy === session.id) })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const items = read()
  // Deduplicate by docId or content hash
  const dupKey = body.docId || (body.content?.slice(0, 80))
  const existing = items.find(i => i.savedBy === session.id &&
    (i.docId === dupKey || i.content?.slice(0, 80) === dupKey))
  if (existing) return NextResponse.json({ data: existing, duplicate: true })
  const item: FavItem = {
    id: crypto.randomUUID(), ...body,
    savedAt: new Date().toISOString(), savedBy: session.id,
  }
  items.unshift(item)
  write(items)
  return NextResponse.json({ data: item })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, docId } = await req.json()
  const items = read()
  const item = id ? items.find(i => i.id === id) : items.find(i => i.docId === docId && i.savedBy === session.id)
  if (item && item.savedBy !== session.id && session.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  write(items.filter(i => i.id !== id))
  return NextResponse.json({ ok: true })
}
