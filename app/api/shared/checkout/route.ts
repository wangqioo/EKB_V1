import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { loadDocs, saveDocs, docDir } from '@/lib/shared'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const action = form.get('action') as string
  const docId = form.get('docId') as string

  if (!docId || !action) return NextResponse.json({ error: '缺少参数' }, { status: 400 })

  const docs = loadDocs()
  const doc = docs.find(d => d.id === docId)
  if (!doc) return NextResponse.json({ error: '文档不存在' }, { status: 404 })

  if (action === 'checkout') {
    if (doc.status === 'checked_out') return NextResponse.json({ error: `文档已被 ${doc.checkedOutBy} 签出` }, { status: 409 })
    doc.status = 'checked_out'
    doc.checkedOutBy = session.id
    doc.checkedOutAt = new Date().toISOString()
    saveDocs(docs)
    return NextResponse.json({ ok: true, doc })
  }

  if (action === 'cancel') {
    if (doc.checkedOutBy !== session.id && session.role !== 'admin') return NextResponse.json({ error: '无权限' }, { status: 403 })
    doc.status = 'available'; doc.checkedOutBy = null; doc.checkedOutAt = null
    saveDocs(docs)
    return NextResponse.json({ ok: true, doc })
  }

  if (action === 'checkin') {
    if (doc.checkedOutBy !== session.id && session.role !== 'admin') return NextResponse.json({ error: '无权限' }, { status: 403 })
    const file = form.get('file') as File | null
    const note = (form.get('note') as string)?.trim() || ''
    if (!file) return NextResponse.json({ error: '请上传新版本文件' }, { status: 400 })

    const newV = doc.currentVersion + 1
    const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
    const storedName = `v${newV}${ext}`
    writeFileSync(join(docDir(docId), storedName), Buffer.from(await file.arrayBuffer()))

    doc.versions.push({ v: newV, fileName: file.name, storedName, size: file.size, uploadedBy: session.id, note, at: new Date().toISOString() })
    doc.currentVersion = newV; doc.status = 'available'; doc.checkedOutBy = null; doc.checkedOutAt = null
    saveDocs(docs)
    return NextResponse.json({ ok: true, doc })
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 })
}
