import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'

const RAGFLOW_BASE = process.env.RAGFLOW_BASE_URL || 'http://localhost:8085'
const API_KEY = process.env.RAGFLOW_API_KEY || 'ragflow-admin-api-key-2026'
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1'
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || 'sk-54d47d0943ca4472b33b2fe757c59a13'

async function getFirstModel(base: string): Promise<string> {
  try {
    const r = await fetch(`${base}/models`, {
      headers: { Authorization: 'Bearer no-key' },
      signal: AbortSignal.timeout(4000),
    })
    if (r.ok) {
      const d = await r.json()
      const id = d.data?.[0]?.id
      if (id) return id
    }
  } catch {}
  return 'default'
}

interface RawChunk {
  id: string
  document_id: string
  document_keyword: string
  dataset_id: string
  content_with_weight: string
  content_ltks?: string
  similarity: number
}

interface KbChunk {
  id: string
  document_id: string
  document_name: string
  dataset_id: string
  content: string
  similarity: number
}

async function retrieveChunks(question: string, datasetIds: string[]): Promise<KbChunk[]> {
  if (datasetIds.length === 0) return []
  try {
    const r = await fetch(`${RAGFLOW_BASE}/api/v1/retrieval`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        dataset_ids: datasetIds,
        page: 1,
        page_size: 8,
        similarity_threshold: 0.1,
        vector_similarity_weight: 0.3,
        top_k: 1024,
        rerank_id: '',
        keyword: false,
      }),
      signal: AbortSignal.timeout(20000),
    })
    const d = await r.json()
    return (d.data?.chunks || []).slice(0, 8).map((c: RawChunk) => ({
      id: c.id,
      document_id: c.document_id,
      document_name: c.document_keyword,
      dataset_id: c.dataset_id,
      content: c.content_with_weight || c.content_ltks || '',
      similarity: c.similarity,
    }))
  } catch {
    return []
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { question, assistantId } = await req.json() as { question: string; assistantId: string }

  // ── Step 1: get dataset_ids for this assistant ──
  let datasetIds: string[] = []
  try {
    const r = await fetch(`${RAGFLOW_BASE}/api/v1/chats?page=1&page_size=50`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    })
    const d = await r.json()
    const chats: { id: string; dataset_ids: string[] }[] = d.data?.chats || []
    const asst = chats.find(c => c.id === assistantId)
    datasetIds = asst?.dataset_ids || []
  } catch {}

  // Fall back to all datasets if assistant lookup failed
  if (datasetIds.length === 0) {
    try {
      const r = await fetch(`${RAGFLOW_BASE}/api/v1/datasets?page=1&page_size=100`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      })
      const d = await r.json()
      datasetIds = (d.data || []).map((ds: { id: string }) => ds.id)
    } catch {}
  }

  // ── Step 2: retrieve relevant knowledge base chunks ──
  const chunks = await retrieveChunks(question, datasetIds)

  // ── Step 3: build system prompt with KB context ──
  const kbContext = chunks.length > 0
    ? '以下是从企业知识库中检索到的相关内容：\n\n' +
      chunks.map((c, i) =>
        `[${i + 1}] 来自文档《${c.document_name}》\n${(c.content || '').trim()}`
      ).join('\n\n---\n\n')
    : ''

  const systemContent = kbContext
    ? `你是企业知识库AI助手，擅长深度分析与推理。\n\n${kbContext}\n\n请基于以上知识库内容，对用户问题进行深入、全面的分析和推理。若引用了上述内容，请在对应位置标注来源序号[1][2]等。若知识库内容不足以回答，请直接说明。`
    : '你是企业知识库AI助手，擅长深度分析与推理。当前知识库中未检索到相关内容，请根据你的知识回答用户问题。'

  // ── Step 4: call Spark1 35B model ──
  const modelName = 'deepseek-v4-flash'

  const errSSE = (msg: string) =>
    new Response(
      `data: ${JSON.stringify({ data: { answer: msg, final: true, reference: {} } })}\n\ndata: true\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } }
    )

  let llmRes: Response
  try {
    llmRes = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_KEY}` },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: question },
        ],
        stream: true,
        temperature: 0.6,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(180_000),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络错误'
    return errSSE(`⚠️ 深度思考连接 Spark1 失败: ${msg}`)
  }

  if (!llmRes.ok || !llmRes.body) {
    return errSSE(`⚠️ Spark1 模型调用失败 (${llmRes.status})`)
  }

  // ── Step 5: convert OpenAI SSE → RAGFlow SSE, attach refs at end ──
  const reader = llmRes.body.getReader()
  const decoder = new TextDecoder()
  const enc = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let buf = ''
      let thinkingFinished = false

      const sendFinal = () => {
        const payload = JSON.stringify({
          data: { answer: '', final: true, reference: { chunks }, thinkingDone: thinkingFinished },
        })
        controller.enqueue(enc.encode(`data: ${payload}\n\ndata: true\n\n`))
        controller.close()
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) { sendFinal(); return }

        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim()
          if (raw === '[DONE]') { sendFinal(); return }
          try {
            const obj = JSON.parse(raw)
            const choice = obj.choices?.[0]
            // Extract reasoning_content (DeepSeek thinking chain)
            const thinkingDelta = choice?.delta?.reasoning_content
            if (thinkingDelta) {
              const chunk = JSON.stringify({ data: { answer: '', thinking: thinkingDelta, final: false, reference: {} } })
              controller.enqueue(enc.encode(`data: ${chunk}\n\n`))
              continue
            }
            // If reasoning_content went null after being set, thinking is done
            if (thinkingFinished === false && choice?.delta?.content && choice?.delta?.reasoning_content === undefined) {
              thinkingFinished = true
            }
            const contentDelta = choice?.delta?.content
            if (contentDelta) {
              const chunk = JSON.stringify({ data: { answer: contentDelta, final: false, reference: {}, thinkingDone: thinkingFinished } })
              controller.enqueue(enc.encode(`data: ${chunk}\n\n`))
            }
            if (choice?.finish_reason === 'stop') { sendFinal(); return }
          } catch {}
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
