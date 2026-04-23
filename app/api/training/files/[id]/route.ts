import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

const FILES_DIR = path.join(process.cwd(), 'data', 'training-files')
const META_FILE = path.join(process.cwd(), 'data', 'training-files.json')

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let files: { id: string; storedName: string; originalName: string; mimeType: string }[] = []
  try { files = JSON.parse(fs.readFileSync(META_FILE, 'utf-8')) } catch {}

  const file = files.find(f => f.id === params.id)
  if (!file) return NextResponse.json({ error: '文件不存在' }, { status: 404 })

  const filePath = path.join(FILES_DIR, file.storedName)
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: '文件已删除' }, { status: 404 })

  const buffer = fs.readFileSync(filePath)
  return new Response(buffer, {
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
