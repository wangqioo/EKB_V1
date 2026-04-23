import { NextRequest, NextResponse } from 'next/server'
import { getSession, loadUsers, updateUser } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const usersMap = loadUsers()
  const users = Object.values(usersMap).map(u => ({
    id: u.id, name: u.name, role: u.role, permissionLevel: u.permissionLevel ?? 0,
  }))
  return NextResponse.json({ users })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { userId, role, permissionLevel } = await req.json()
  if (userId === session.id) return NextResponse.json({ error: '不能修改自己的权限' }, { status: 400 })
  const ok = updateUser(userId, {
    ...(role !== undefined ? { role } : {}),
    ...(permissionLevel !== undefined ? { permissionLevel } : {}),
  })
  if (!ok) return NextResponse.json({ error: '用户不存在' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
