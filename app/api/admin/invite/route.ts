import { NextResponse } from 'next/server'
import { getSession, loadInvite, resetInviteToken } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const data = loadInvite()
  return NextResponse.json({ token: data.token, createdAt: data.createdAt, records: data.records || [] })
}

export async function POST() {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const data = resetInviteToken()
  return NextResponse.json({ token: data.token, createdAt: data.createdAt, records: data.records || [] })
}
