// EKB Shared Type Definitions
// Used by both LibraryClient and SearchClient components

export interface Dataset {
  id: string
  name: string
  description?: string
  document_count?: number
}

export interface DocMeta {
  dept?: string
  type?: string
  confidential?: boolean
  ai_summary?: string
  deleted?: boolean
  uploadedBy?: string
}

export interface Doc {
  id: string
  name: string
  size: number
  run: string
  create_date?: string
  meta?: DocMeta
}

export interface Folder {
  id: string
  name: string
  docIds: string[]
}

export interface Chunk {
  id: string
  docId: string
  docName: string
  datasetId: string
  content: string
  similarity: number
}

export const DEPTS = ['行政部', '技术部', '市场部', '财务部', '人事部', '运营部', '法务部', '其他'] as const
export type DeptType = typeof DEPTS[number]

export const DOC_TYPES = ['SOP', '合同', '政策', '培训资料', '会议纪要', '技术文档', '报告', '表格', '其他'] as const
export type DocType = typeof DOC_TYPES[number]

export const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  DONE:    { label: '已完成', color: '#16a34a', bg: '#dcfce7' },
  RUNNING: { label: '解析中', color: '#d97706', bg: '#fef9c3' },
  PENDING: { label: '待处理', color: '#64748b', bg: '#f1f5f9' },
  UNSTART: { label: '未开始', color: '#64748b', bg: '#f1f5f9' },
  FAIL:    { label: '失败',   color: '#dc2626', bg: '#fee2e2' },
  CANCEL:  { label: '已取消', color: '#64748b', bg: '#f1f5f9' },
}

export interface PreviewState {
  doc: Doc | null
  content: string
  loading: boolean
}
