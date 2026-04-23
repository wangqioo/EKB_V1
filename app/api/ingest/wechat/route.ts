import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

const HUB_URL = process.env.HUB_URL || 'http://localhost:8096'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })
  if (session.role !== 'admin' && (session.permissionLevel ?? 0) < 1)
    return NextResponse.json({ error: '权限不足' }, { status: 403 })

  try {
    const body = await req.json()
    const upstream = await fetch(`${HUB_URL}/api/import/wechat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await upstream.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
