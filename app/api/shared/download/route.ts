import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { loadDocs, docDir } from '@/lib/shared'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

function getMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain', md: 'text/plain', csv: 'text/csv',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  }
  return map[ext] || 'application/octet-stream'
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const docId = req.nextUrl.searchParams.get('docId')
  const vStr = req.nextUrl.searchParams.get('v')
  if (!docId) return NextResponse.json({ error: '缺少 docId' }, { status: 400 })

  const docs = loadDocs()
  const doc = docs.find(d => d.id === docId)
  if (!doc) return NextResponse.json({ error: '文档不存在' }, { status: 404 })

  const version = vStr ? doc.versions.find(v => v.v === parseInt(vStr)) : doc.versions[doc.versions.length - 1]
  if (!version) return NextResponse.json({ error: '版本不存在' }, { status: 404 })

  const filePath = join(docDir(docId), version.storedName)
  if (!existsSync(filePath)) return NextResponse.json({ error: '文件已丢失' }, { status: 404 })

  const buffer = readFileSync(filePath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': getMime(version.fileName),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(version.fileName)}"`,
      'Content-Length': String(buffer.length),
    },
  })
}
