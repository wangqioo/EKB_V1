import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDatasets, createDataset, deleteDataset } from '@/lib/ragflow'

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const datasets = await getDatasets()
  return NextResponse.json({ data: datasets })
}

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin' && (user.permissionLevel ?? 0) < 2) {
    return NextResponse.json({ error: '需要最高权限才能创建知识库' }, { status: 403 })
  }
  const { name, description } = await req.json()
  if (!name) return NextResponse.json({ error: '请填写知识库名称' }, { status: 400 })
  const result = await createDataset(name, description)
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: '仅管理员可删除知识库' }, { status: 403 })
  const { datasetId } = await req.json()
  const result = await deleteDataset(datasetId)
  return NextResponse.json(result)
}
