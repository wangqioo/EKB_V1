import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const LINKBOX_FILE = path.join(process.cwd(), 'data', 'linkbox.json')

export interface LinkboxItem {
  id: string
  type: 'link' | 'image' | 'text' | 'note'
  title: string
  url?: string
  content?: string
  ai_intro?: string
  created_at: string
  created_by: string
}

function read(): LinkboxItem[] {
  try { return JSON.parse(fs.readFileSync(LINKBOX_FILE, 'utf-8')) } catch { return [] }
}
function write(data: LinkboxItem[]) {
  const dir = path.dirname(LINKBOX_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(LINKBOX_FILE, JSON.stringify(data, null, 2))
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ data: read() })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const canAdd = session.role === 'admin' || (session.permissionLevel ?? 0) >= 1
  if (!canAdd) return NextResponse.json({ error: '需要中级或以上权限' }, { status: 403 })
  const { type, title, url, content, ai_intro } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: '标题不能为空' }, { status: 400 })
  const item: LinkboxItem = {
    id: crypto.randomUUID(), type: type || 'link', title: title.trim(),
    url, content, ai_intro,
    created_at: new Date().toISOString(), created_by: session.name,
  }
  const items = read()
  items.unshift(item)
  write(items)
  return NextResponse.json({ data: item })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, ...updates } = await req.json()
  const items = read()
  const idx = items.findIndex(i => i.id === id)
  if (idx < 0) return NextResponse.json({ error: '不存在' }, { status: 404 })
  items[idx] = { ...items[idx], ...updates }
  write(items)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const canDelete = session.role === 'admin' || (session.permissionLevel ?? 0) >= 1
  if (!canDelete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json()
  write(read().filter(i => i.id !== id))
  return NextResponse.json({ ok: true })
}
