import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const COURSES_FILE = path.join(process.cwd(), 'data', 'courses.json')

export interface QuizQuestion { q: string; options: string[]; answer: number }
export interface Course {
  id: string; title: string; description: string; content: string
  quiz: QuizQuestion[]; created_at: string; created_by: string
}

function read(): Course[] {
  try { return JSON.parse(fs.readFileSync(COURSES_FILE, 'utf-8')) } catch { return [] }
}
function write(data: Course[]) {
  const dir = path.dirname(COURSES_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(COURSES_FILE, JSON.stringify(data, null, 2))
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ data: read() })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { title, description, content, quiz } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: '标题不能为空' }, { status: 400 })
  const course: Course = {
    id: crypto.randomUUID(), title: title.trim(),
    description: description?.trim() || '', content: content || '',
    quiz: quiz || [], created_at: new Date().toISOString(), created_by: session.name,
  }
  const courses = read()
  courses.push(course)
  write(courses)
  return NextResponse.json({ data: course })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, ...updates } = await req.json()
  const courses = read()
  const idx = courses.findIndex(c => c.id === id)
  if (idx < 0) return NextResponse.json({ error: '课程不存在' }, { status: 404 })
  courses[idx] = { ...courses[idx], ...updates }
  write(courses)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json()
  write(read().filter(c => c.id !== id))
  return NextResponse.json({ ok: true })
}
