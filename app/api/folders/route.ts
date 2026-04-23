import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const DATA_DIR = path.join(process.cwd(), 'data')
const FOLDERS_FILE = path.join(DATA_DIR, 'folders.json')

interface FolderRecord { id: string; name: string; docIds: string[] }

function readAll(): Record<string, FolderRecord[]> {
  try {
    if (!fs.existsSync(FOLDERS_FILE)) return {}
    return JSON.parse(fs.readFileSync(FOLDERS_FILE, 'utf-8'))
  } catch { return {} }
}

function writeAll(data: Record<string, FolderRecord[]>) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(FOLDERS_FILE, JSON.stringify(data, null, 2))
}

// GET /api/folders?datasetId=...
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const dsId = req.nextUrl.searchParams.get('datasetId') || ''
  const all = readAll()
  return NextResponse.json({ folders: all[dsId] || [] })
}

// POST /api/folders  { datasetId, name }
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const { datasetId, name } = await req.json()
  if (!datasetId || !name?.trim()) return NextResponse.json({ error: '参数缺失' }, { status: 400 })
  const all = readAll()
  if (!all[datasetId]) all[datasetId] = []
  const folder: FolderRecord = { id: crypto.randomUUID(), name: name.trim(), docIds: [] }
  all[datasetId].push(folder)
  writeAll(all)
  return NextResponse.json({ folder })
}

// PATCH /api/folders  { datasetId, folderId, name?, addDocIds?, removeDocIds? }
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const { datasetId, folderId, name, addDocIds, removeDocIds } = await req.json()
  const all = readAll()
  const folders = all[datasetId] || []
  const folder = folders.find(f => f.id === folderId)
  if (!folder) return NextResponse.json({ error: '文件夹不存在' }, { status: 404 })
  if (name !== undefined) folder.name = name.trim()
  if (addDocIds?.length) {
    // Remove from other folders first to avoid duplicates
    for (const f of folders) {
      if (f.id !== folderId) f.docIds = f.docIds.filter(d => !addDocIds.includes(d))
    }
    for (const id of addDocIds) {
      if (!folder.docIds.includes(id)) folder.docIds.push(id)
    }
  }
  if (removeDocIds?.length) {
    folder.docIds = folder.docIds.filter(d => !removeDocIds.includes(d))
  }
  all[datasetId] = folders
  writeAll(all)
  return NextResponse.json({ ok: true })
}

// DELETE /api/folders  { datasetId, folderId }
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const { datasetId, folderId } = await req.json()
  const all = readAll()
  if (all[datasetId]) all[datasetId] = all[datasetId].filter(f => f.id !== folderId)
  writeAll(all)
  return NextResponse.json({ ok: true })
}
