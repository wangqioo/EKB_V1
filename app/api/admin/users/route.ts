import { NextRequest, NextResponse } from 'next/server'
import { getSession, loadUsers, updateUser, createUserByAdmin, deleteUser } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const usersMap = loadUsers()
  const users = Object.values(usersMap).map(u => ({
    id: u.id, name: u.name, role: u.role,
    permissionLevel: u.permissionLevel ?? 0,
    email: u.email, phone: u.phone,
    department: u.department, position: u.position,
    employeeId: u.employeeId, createdAt: u.createdAt,
  }))
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { username, password, name, email, phone, department, position, employeeId, role, permissionLevel } = await req.json()
  const result = createUserByAdmin(username, password, { name, email, phone, department, position, employeeId, role, permissionLevel })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, user: result.user })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { userId, ...updates } = await req.json()
  if (userId === session.id && (updates.role !== undefined || updates.permissionLevel !== undefined)) {
    return NextResponse.json({ error: '不能修改自己的角色/权限' }, { status: 400 })
  }
  const ok = updateUser(userId, updates)
  if (!ok) return NextResponse.json({ error: '用户不存在' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { userId } = await req.json()
  if (userId === session.id) return NextResponse.json({ error: '不能删除自己' }, { status: 400 })
  const ok = deleteUser(userId)
  if (!ok) return NextResponse.json({ error: '用户不存在' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
