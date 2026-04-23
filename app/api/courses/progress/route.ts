import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

const PROGRESS_FILE = path.join(process.cwd(), 'data', 'progress.json')
const COURSES_FILE = path.join(process.cwd(), 'data', 'courses.json')

interface Progress { viewed: boolean; quiz_passed: boolean; quiz_score: number; last_view?: string }

function read(): Record<string, Progress> {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8')) } catch { return {} }
}
function write(data: Record<string, Progress>) {
  const dir = path.dirname(PROGRESS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2))
}

// GET /api/courses/progress  → current user's progress map { courseId: Progress }
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const all = read()
  const prefix = session.id + '_'
  const result: Record<string, Progress> = {}
  for (const [k, v] of Object.entries(all)) {
    if (k.startsWith(prefix)) result[k.slice(prefix.length)] = v
  }
  return NextResponse.json({ data: result })
}

// POST /api/courses/progress  { courseId, action: 'view'|'quiz', answers?: number[] }
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { courseId, action, answers } = await req.json()
  const key = `${session.id}_${courseId}`
  const all = read()
  const cur = all[key] || { viewed: false, quiz_passed: false, quiz_score: 0 }

  if (action === 'view') {
    all[key] = { ...cur, viewed: true, last_view: new Date().toISOString() }
    write(all)
    return NextResponse.json({ ok: true })
  }

  if (action === 'quiz' && Array.isArray(answers)) {
    let courses: { id: string; quiz: { answer: number }[] }[] = []
    try { courses = JSON.parse(fs.readFileSync(COURSES_FILE, 'utf-8')) } catch {}
    const course = courses.find(c => c.id === courseId)
    if (!course) return NextResponse.json({ error: '课程不存在' }, { status: 404 })
    if (course.quiz.length === 0) {
      all[key] = { ...cur, quiz_passed: true, quiz_score: 100 }
      write(all)
      return NextResponse.json({ passed: true, score: 100, correct: 0, total: 0 })
    }
    let correct = 0
    for (let i = 0; i < course.quiz.length; i++) {
      if (answers[i] === course.quiz[i].answer) correct++
    }
    const score = Math.round((correct / course.quiz.length) * 100)
    const passed = score >= 60
    all[key] = { ...cur, quiz_passed: passed, quiz_score: score }
    write(all)
    return NextResponse.json({ passed, score, correct, total: course.quiz.length })
  }

  return NextResponse.json({ error: '无效操作' }, { status: 400 })
}
