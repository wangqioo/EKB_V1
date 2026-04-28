import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

const LLM_ENDPOINTS: Record<string, { base: string }> = {
  qwen:   { base: 'http://localhost:8086/v1' },
  gemma4: { base: 'http://150.158.146.192:6139/v1' },
}

const RAGFLOW_BASE = process.env.RAGFLOW_BASE_URL || 'http://localhost:8085'
const API_KEY = process.env.RAGFLOW_API_KEY || 'ragflow-admin-api-key-2026'

async function getFirstModel(base: string): Promise<string> {
  try {
    const r = await fetch(`${base}/models`, {
      headers: { Authorization: 'Bearer no-key' },
      signal: AbortSignal.timeout(3000),
    })
    if (r.ok) {
      const d = await r.json()
      return d.data?.[0]?.id || 'default'
    }
  } catch {}
  return 'default'
}

// Search ALL datasets instead of using assistantId for better coverage
async function searchKnowledgeBase(query: string): Promise<{ type: string; content: string }> {
  try {
    // Get all datasets first
    const datasetsRes = await fetch(`${RAGFLOW_BASE}/api/v1/datasets`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal: AbortSignal.timeout(5000),
    })
    
    if (!datasetsRes.ok) return { type: 'info', content: '无法获取知识库列表' }
    
    const datasets = await datasetsRes.json()
    const datasetList = datasets.data || []
    
    // Search each dataset and collect results
    const searchPromises = datasetList.slice(0, 5).map(async (ds: any) => {
      try {
        const r = await fetch(`${RAGFLOW_BASE}/api/v1/datasets/${ds.id}/search`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, page: 1, page_size: 3 }),
          signal: AbortSignal.timeout(8000),
        })
        if (r.ok) {
          const d = await r.json()
          const results = d.data?.hits || []
          return results.map((hit: any) => `[${ds.name}] ${hit.content}`).join('\n')
        }
      } catch {}
      return null
    })
    
    const searchResults = await Promise.all(searchPromises)
    const validResults = searchResults.filter(Boolean).join('\n\n')
    
    if (validResults) {
      return { type: 'knowledge', content: validResults }
    }
    return { type: 'info', content: '知识库中未找到相关内容' }
  } catch {
    return { type: 'error', content: '知识库搜索失败' }
  }
}

// Improved web search using Bing HTML (more reliable than DDG)
async function searchWeb(query: string): Promise<{ type: string; results: Array<{ title: string; url: string; snippet: string }> }> {
  try {
    // Try Bing first, fallback to DDG
    let html: string = ""
    
    try {
      const r = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EKB/1.0)' },
        signal: AbortSignal.timeout(12000),
      })
      if (r.ok) html = await r.text()
    } catch {}
    
    if (!html || !html.length) {
      // Fallback to DDG
      const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(12000),
      })
      if (!r.ok) return { type: 'error', results: [] }
      html = await r.text()
    }
    
    const results: Array<{ title: string; url: string; snippet: string }> = []
    
    // Parse Bing results
    const bingRegex = /<li class="b_algo"><h2><a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a><\/h2>[^<]*<p[^>]*>(.*?)<\/p>/g
    let match
    while ((match = bingRegex.exec(html)) !== null && results.length < 5) {
      const url = match[1]
      if (url.startsWith('http') && !url.includes('bing.com')) {
        const title = match[2].replace(/<[^>]*>/g, '').trim()
        const snippet = match[3]?.replace(/<[^>]*>/g, '').trim() || ''
        results.push({ title: title || url.substring(0, 50), url, snippet })
      }
    }
    
    // Fallback DDG parsing if Bing didn't work
    if (results.length === 0) {
      const ddgRegex = /<a[^>]*href="([^"]*?)"[^>]*>(.*?)<\/a>/g
      let ddgMatch
      while ((ddgMatch = ddgRegex.exec(html)) !== null && results.length < 5) {
        const url = ddgMatch[1]
        if (url.startsWith('http') && !url.includes('duckduckgo.com')) {
          const title = ddgMatch[2].replace(/<[^>]*>/g, '').trim()
          // Try to find snippet in meta description or nearby text
          const snippetRegex = new RegExp(`href="${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>.*?<\\/a>\\s*.*?(?:<meta[^>]*content="([^"]*)")`, 's')
          const snipMatch = html.match(snippetRegex)
          results.push({ title: title || url.substring(0, 50), url, snippet: snipMatch?.[1] || '' })
        }
      }
    }
    
    return { type: 'web', results }
  } catch {
    return { type: 'error', results: [] }
  }
}

async function* convertStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const raw = line.slice(5).trim()
      if (raw === '[DONE]') {
        yield `data: ${JSON.stringify({ data: { answer: '', final: true, reference: {} } })}\n\n`
        return
      }
      try {
        const obj = JSON.parse(raw)
        const delta = obj.choices?.[0]?.delta?.content
        if (delta) {
          yield `data: ${JSON.stringify({ data: { answer: delta, final: false, reference: {} } })}\n\n`
        }
        if (obj.choices?.[0]?.finish_reason === 'stop') {
          yield `data: ${JSON.stringify({ data: { answer: '', final: true, reference: {} } })}\n\n`
          return
        }
      } catch {}
    }
  }
  yield `data: ${JSON.stringify({ data: { answer: '', final: true, reference: {} } })}\n\n`
}

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { question, model = 'qwen', kbAssistantId, enableWebSearch } = await req.json() as {
    question: string
    model?: 'qwen' | 'gemma4'
    kbAssistantId?: string
    enableWebSearch?: boolean
  }

  if (!question) return NextResponse.json({ error: '请输入问题' }, { status: 400 })

  // Phase 1: Execute tools in parallel
  const kbResultRef: { result: { type: string; content: string } | null } = { result: null }
  const webResultsRef: { results: Array<{ title: string; url: string; snippet: string }> | null } = { results: null }
  const toolStart = Date.now()

  const toolPromises: Promise<void>[] = []

  // Always search knowledge base (regardless of kbAssistantId)
  toolPromises.push(
    (async () => { kbResultRef.result = await searchKnowledgeBase(question) })()
  )

  if (enableWebSearch) {
    toolPromises.push(
      (async () => { const r = await searchWeb(question); webResultsRef.results = r.results; })()
    )
  }

  // Wait for tools with timeout
  await Promise.allSettled(toolPromises).then(() => {})

  const kbResult = kbResultRef.result
  const results = webResultsRef.results

  // Build context from tool results
  let systemContent = '你是企业知识库AI超级智能体，具备知识库检索和联网搜索能力。请基于工具返回的结果回答问题，简洁准确。\n\n重要：\n1. 回答时使用markdown格式（**加粗**、*斜体*、列表等）\n2. 如果用户要求生成文档，请在回答末尾包含完整文档内容\n3. 展示你的思考过程（用>引用块表示）'
  
  if (kbResult) {
    systemContent += `\n\n📚 知识库结果：${kbResult.content}`
  }
  if (results && results.length > 0) {
    systemContent += '\n\n🌐 网络搜索结果：' + results.map((r, i) => `[${i+1}] **${r.title}**\n来源：${r.url}\n摘要：${r.snippet}`).join('\n\n')
  }

  // Phase 2: Generate response with LLM
  const { base } = LLM_ENDPOINTS[model] || LLM_ENDPOINTS.qwen
  const modelName = await getFirstModel(base)

  let llmRes: Response
  try {
    llmRes = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer no-key' },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: question },
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 4000,
      }),
      signal: AbortSignal.timeout(180_000),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '连接失败'
    return new Response(`data: ${JSON.stringify({ data: { answer: `⚠️ ${msg}`, final: true, reference: {} } })}\n\n` + `data: true\n\n`, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    })
  }

  if (!llmRes.ok || !llmRes.body) {
    return new Response(`data: ${JSON.stringify({ data: { answer: `⚠️ 模型调用失败 (${llmRes.status})`, final: true, reference: {} } })}\n\n` + `data: true\n\n`, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    })
  }

  const gen = convertStream(llmRes.body)
  const stream = new ReadableStream({
    async pull(controller) {
      const { value, done } = await gen.next()
      if (done) controller.close()
      else controller.enqueue(new TextEncoder().encode(value))
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
