import { NextRequest, NextResponse } from 'next/server'
import { registerUser, createSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { username, password, name, adminKey, inviteToken } = await req.json()
  const result = registerUser(username, password, name, adminKey, inviteToken)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  await createSession(result.user!)
  return NextResponse.json({ ok: true, name: result.user!.name, role: result.user!.role })
}
