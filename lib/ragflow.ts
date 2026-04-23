const RAGFLOW_BASE = process.env.RAGFLOW_BASE_URL || 'http://localhost:8085'
const RAGFLOW_API_KEY = process.env.RAGFLOW_API_KEY || 'ragflow-admin-api-key-2026'

const headers = () => ({
  'Authorization': `Bearer ${RAGFLOW_API_KEY}`,
  'Content-Type': 'application/json',
})

export async function getDatasets() {
  const r = await fetch(`${RAGFLOW_BASE}/api/v1/datasets?page=1&page_size=100`, { headers: headers() })
  const d = await r.json()
  return d.data || []
}

export async function createDataset(name: string, description?: string) {
  const r = await fetch(`${RAGFLOW_BASE}/api/v1/datasets`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name, description: description || '', chunk_method: 'naive' }),
  })
  return r.json()
}

export async function deleteDataset(datasetId: string) {
  const r = await fetch(`${RAGFLOW_BASE}/api/v1/datasets`, {
    method: 'DELETE',
    headers: headers(),
    body: JSON.stringify({ ids: [datasetId] }),
  })
  return r.json()
}

export async function uploadDocument(datasetId: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  const r = await fetch(`${RAGFLOW_BASE}/api/v1/datasets/${datasetId}/documents`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RAGFLOW_API_KEY}` },
    body: form,
  })
  return r.json()
}

export async function listDocuments(datasetId: string) {
  const r = await fetch(`${RAGFLOW_BASE}/api/v1/datasets/${datasetId}/documents?page=1&page_size=100`, { headers: headers() })
  const d = await r.json()
  return d.data?.docs || []
}

export async function deleteDocument(datasetId: string, docIds: string[]) {
  const r = await fetch(`${RAGFLOW_BASE}/api/v1/datasets/${datasetId}/documents`, {
    method: 'DELETE',
    headers: headers(),
    body: JSON.stringify({ ids: docIds }),
  })
  return r.json()
}

export async function createSession(assistantId: string, name = '新对话') {
  const r = await fetch(`${RAGFLOW_BASE}/api/v1/chats/${assistantId}/sessions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name }),
    signal: AbortSignal.timeout(15000),
  })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    throw new Error(`RAGFlow ${r.status}: ${txt.slice(0, 200)}`)
  }
  const d = await r.json()
  return d.data
}

export async function getAssistants() {
  const r = await fetch(`${RAGFLOW_BASE}/api/v1/chats?page=1&page_size=10`, { headers: headers() })
  const d = await r.json()
  return d.data?.chats || []
}

export async function* streamChat(assistantId: string, sessionId: string, question: string) {
  const r = await fetch(`${RAGFLOW_BASE}/api/v1/chats/${assistantId}/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ question, session_id: sessionId, stream: true }),
  })
  if (!r.body) return
  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value)
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data:')) {
        try {
          const data = JSON.parse(line.slice(5).trim())
          if (data.data?.answer !== undefined) yield data.data.answer
        } catch {}
      }
    }
  }
}
