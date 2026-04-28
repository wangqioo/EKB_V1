import { NextRequest, NextResponse } from 'next/server'
import { getSession, loadUsers } from '@/lib/auth'
import { loadDocs, saveDocs, docDir } from '@/lib/shared'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import crypto from 'node:crypto'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const docs = loadDocs()
  const users = loadUsers()
  const getName = (id: string) => users[id]?.name || id

  const enriched = docs.map(d => ({
    ...d,
    checkedOutByName: d.checkedOutBy ? getName(d.checkedOutBy) : null,
    createdByName: getName(d.createdBy),
    versions: d.versions.map(v => ({ ...v, uploadedByName: getName(v.uploadedBy) })),
  }))

  return NextResponse.json({ docs: enriched })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const title = (form.get('title') as string)?.trim()
  const description = (form.get('description') as string)?.trim() || ''
  const note = (form.get('note') as string)?.trim() || '初始版本'
  const file = form.get('file') as File | null

  if (!title) return NextResponse.json({ error: '请填写文档标题' }, { status: 400 })
  if (!file) return NextResponse.json({ error: '请上传初始文件' }, { status: 400 })

  const id = 'doc_' + crypto.randomBytes(6).toString('hex')
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
  const storedName = `v1${ext}`
  const dir = docDir(id)
  writeFileSync(join(dir, storedName), Buffer.from(await file.arrayBuffer()))

  const doc = {
    id, title, description, status: 'available' as const,
    checkedOutBy: null, checkedOutAt: null,
    currentVersion: 1, createdBy: session.id, createdAt: new Date().toISOString(),
    versions: [{ v: 1, fileName: file.name, storedName, size: file.size, uploadedBy: session.id, note, at: new Date().toISOString() }],
  }

  const docs = loadDocs()
  docs.unshift(doc)
  saveDocs(docs)
  return NextResponse.json({ ok: true, doc })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { docId } = await req.json()
  const docs = loadDocs()
  const idx = docs.findIndex(d => d.id === docId)
  if (idx === -1) return NextResponse.json({ error: '文档不存在' }, { status: 404 })
  docs.splice(idx, 1)
  saveDocs(docs)
  return NextResponse.json({ ok: true })
}
