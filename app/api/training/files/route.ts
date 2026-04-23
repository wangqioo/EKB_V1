import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const FILES_DIR = path.join(process.cwd(), 'data', 'training-files')
const META_FILE = path.join(process.cwd(), 'data', 'training-files.json')

interface TrainingFile {
  id: string
  originalName: string
  storedName: string
  mimeType: string
  size: number
  uploadedAt: string
  uploadedBy: string
}

function readMeta(): TrainingFile[] {
  try { return JSON.parse(fs.readFileSync(META_FILE, 'utf-8')) } catch { return [] }
}
function writeMeta(data: TrainingFile[]) {
  const dir = path.dirname(META_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(META_FILE, JSON.stringify(data, null, 2))
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ data: readMeta() })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: '没有文件' }, { status: 400 })

  if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true })

  const id = crypto.randomUUID()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const storedName = `${id}.${ext}`
  const filePath = path.join(FILES_DIR, storedName)

  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(filePath, buffer)

  const meta: TrainingFile = {
    id,
    originalName: file.name,
    storedName,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: session.name,
  }

  const files = readMeta()
  files.push(meta)
  writeMeta(files)

  return NextResponse.json({ data: meta })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  const files = readMeta()
  const file = files.find(f => f.id === id)
  if (!file) return NextResponse.json({ error: '文件不存在' }, { status: 404 })

  const filePath = path.join(FILES_DIR, file.storedName)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

  writeMeta(files.filter(f => f.id !== id))
  return NextResponse.json({ ok: true })
}
