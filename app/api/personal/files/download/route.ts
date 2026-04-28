import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const PERSONAL_DIR = join(process.cwd(), 'data', 'personal')

interface FileMeta { id: string; name: string; size: number; uploadedAt: string; storedName: string }

function loadMeta(userId: string): FileMeta[] {
  const p = join(PERSONAL_DIR, userId, '_meta.json')
  if (!existsSync(p)) return []
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return [] }
}

function getMimeType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    txt: 'text/plain', md: 'text/plain', csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  }
  return map[ext] || 'application/octet-stream'
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fileId = req.nextUrl.searchParams.get('fileId')
  if (!fileId) return NextResponse.json({ error: '缺少 fileId' }, { status: 400 })

  const meta = loadMeta(session.id)
  const entry = meta.find(f => f.id === fileId)
  if (!entry) return NextResponse.json({ error: '文件不存在' }, { status: 404 })

  const filePath = join(PERSONAL_DIR, session.id, entry.storedName)
  if (!existsSync(filePath)) return NextResponse.json({ error: '文件已丢失' }, { status: 404 })

  const buffer = readFileSync(filePath)
  const mime = getMimeType(entry.name)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `inline; filename="${encodeURIComponent(entry.name)}"`,
      'Content-Length': String(buffer.length),
    },
  })
}
