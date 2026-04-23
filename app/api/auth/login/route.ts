import { NextRequest, NextResponse } from 'next/server'
import { createSession, verifyCredentials } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  const user = verifyCredentials(username, password)
  if (!user) return NextResponse.json({ ok: false })
  await createSession(user)
  return NextResponse.json({ ok: true, name: user.name, role: user.role })
}
