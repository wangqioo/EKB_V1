import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import crypto from 'node:crypto'

const PERSONAL_DIR = join(process.cwd(), 'data', 'personal')

function userDir(userId: string) {
  const d = join(PERSONAL_DIR, userId)
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

function metaPath(userId: string) {
  return join(userDir(userId), '_meta.json')
}

interface FileMeta { id: string; name: string; size: number; uploadedAt: string; storedName: string }

function loadMeta(userId: string): FileMeta[] {
  const p = metaPath(userId)
  if (!existsSync(p)) return []
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return [] }
}

function saveMeta(userId: string, files: FileMeta[]) {
  writeFileSync(metaPath(userId), JSON.stringify(files, null, 2))
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const files = loadMeta(session.id).map(f => ({
    id: f.id, name: f.name, size: f.size, uploadedAt: f.uploadedAt,
  }))
  return NextResponse.json({ files })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: '缺少文件' }, { status: 400 })

  const id = crypto.randomBytes(8).toString('hex')
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
  const storedName = id + ext

  const buffer = Buffer.from(await file.arrayBuffer())
  const dir = userDir(session.id)
  writeFileSync(join(dir, storedName), buffer)

  const meta = loadMeta(session.id)
  meta.push({ id, name: file.name, size: file.size, uploadedAt: new Date().toISOString(), storedName })
  saveMeta(session.id, meta)

  return NextResponse.json({ ok: true, id })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fileId } = await req.json()
  const meta = loadMeta(session.id)
  const entry = meta.find(f => f.id === fileId)
  if (!entry) return NextResponse.json({ error: '文件不存在' }, { status: 404 })

  const filePath = join(userDir(session.id), entry.storedName)
  if (existsSync(filePath)) unlinkSync(filePath)

  saveMeta(session.id, meta.filter(f => f.id !== fileId))
  return NextResponse.json({ ok: true })
}
