import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const DATA_DIR = join(process.cwd(), 'data')
const SHARED_DOCS_FILE = join(DATA_DIR, 'shared_docs.json')
const SHARED_FILES_DIR = join(DATA_DIR, 'shared_files')

export interface DocVersion {
  v: number; fileName: string; storedName: string; size: number
  uploadedBy: string; note: string; at: string
}

export interface SharedDoc {
  id: string; title: string; description: string
  status: 'available' | 'checked_out'
  checkedOutBy: string | null; checkedOutAt: string | null
  currentVersion: number; createdBy: string; createdAt: string
  versions: DocVersion[]
}

export function ensureDirs() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  if (!existsSync(SHARED_FILES_DIR)) mkdirSync(SHARED_FILES_DIR, { recursive: true })
}

export function loadDocs(): SharedDoc[] {
  ensureDirs()
  if (!existsSync(SHARED_DOCS_FILE)) return []
  try { return JSON.parse(readFileSync(SHARED_DOCS_FILE, 'utf-8')) } catch { return [] }
}

export function saveDocs(docs: SharedDoc[]) {
  ensureDirs()
  writeFileSync(SHARED_DOCS_FILE, JSON.stringify(docs, null, 2))
}

export function docDir(docId: string): string {
  const d = join(SHARED_FILES_DIR, docId)
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}
