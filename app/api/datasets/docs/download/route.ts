import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

const RAGFLOW_BASE = process.env.RAGFLOW_BASE_URL || 'http://localhost:8085'
const API_KEY = process.env.RAGFLOW_API_KEY || 'ragflow-admin-api-key-2026'
const META_FILE = path.join(process.cwd(), 'data', 'doc_meta.json')

function readMeta(): Record<string, { confidential?: boolean }> {
  try { return JSON.parse(fs.readFileSync(META_FILE, 'utf-8')) } catch { return {} }
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const datasetId = req.nextUrl.searchParams.get('datasetId') || ''
  const docId = req.nextUrl.searchParams.get('docId') || ''
  if (!datasetId || !docId) return NextResponse.json({ error: '参数缺失' }, { status: 400 })

  const meta = readMeta()
  if (meta[docId]?.confidential) {
    const canAccess = session.role === 'admin' || (session.permissionLevel ?? 0) >= 1
    if (!canAccess) {
      return NextResponse.json({ error: '机密文件：需要中级或以上权限才能下载' }, { status: 403 })
    }
  }

  const upstream = await fetch(
    `${RAGFLOW_BASE}/api/v1/datasets/${datasetId}/documents/${docId}`,
    { headers: { Authorization: `Bearer ${API_KEY}` } }
  )
  if (!upstream.ok) return NextResponse.json({ error: '文件不存在' }, { status: 404 })

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
  const disposition = upstream.headers.get('content-disposition') || 'attachment'
  return new NextResponse(upstream.body, {
    headers: { 'Content-Type': contentType, 'Content-Disposition': disposition },
  })
}
