import { NextRequest, NextResponse } from 'next/server'
import { getSession, loadDepartments, saveDepartments, Department } from '@/lib/auth'
import crypto from 'node:crypto'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json({ departments: loadDepartments() })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { name, managerId } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: '部门名称不能为空' }, { status: 400 })
  const depts = loadDepartments()
  if (depts.find(d => d.name === name.trim())) return NextResponse.json({ error: '部门名称已存在' }, { status: 400 })
  const dept: Department = {
    id: 'dept_' + crypto.randomBytes(4).toString('hex'),
    name: name.trim(),
    managerId: managerId || undefined,
    createdAt: new Date().toISOString(),
  }
  depts.push(dept)
  saveDepartments(depts)
  return NextResponse.json({ ok: true, department: dept })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, name, managerId } = await req.json()
  const depts = loadDepartments()
  const idx = depts.findIndex(d => d.id === id)
  if (idx === -1) return NextResponse.json({ error: '部门不存在' }, { status: 404 })
  if (name?.trim()) depts[idx].name = name.trim()
  if (managerId !== undefined) depts[idx].managerId = managerId || undefined
  saveDepartments(depts)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json()
  const depts = loadDepartments()
  const idx = depts.findIndex(d => d.id === id)
  if (idx === -1) return NextResponse.json({ error: '部门不存在' }, { status: 404 })
  depts.splice(idx, 1)
  saveDepartments(depts)
  return NextResponse.json({ ok: true })
}
