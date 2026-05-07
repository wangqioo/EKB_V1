import { NextRequest, NextResponse } from 'next/server'

const LLM_BASE = 'https://api.deepseek.com/v1'
const LLM_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-54d47d0943ca4472b33b2fe757c59a13'

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

async function* convertStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let thinkingFinished = false
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
        yield `data: ${JSON.stringify({ data: { answer: '', final: true, reference: {}, thinkingDone: thinkingFinished } })}\n\n`
        return
      }
      try {
        const obj = JSON.parse(raw)
        const choice = obj.choices?.[0]
        // Extract reasoning_content (DeepSeek thinking chain)
        const thinkingDelta = choice?.delta?.reasoning_content
        if (thinkingDelta) {
          yield `data: ${JSON.stringify({ data: { answer: '', thinking: thinkingDelta, final: false, reference: {} } })}\n\n`
          continue
        }
        // If reasoning_content went null after being set, thinking is done
        if (thinkingFinished === false && choice?.delta?.content && choice?.delta?.reasoning_content === undefined) {
          thinkingFinished = true
        }
        const contentDelta = choice?.delta?.content
        if (contentDelta) {
          yield `data: ${JSON.stringify({ data: { answer: contentDelta, final: false, reference: {}, thinkingDone: thinkingFinished } })}\n\n`
        }
        if (choice?.finish_reason === 'stop') {
          yield `data: ${JSON.stringify({ data: { answer: '', final: true, reference: {}, thinkingDone: thinkingFinished } })}\n\n`
          return
        }
      } catch {}
    }
  }
  yield `data: ${JSON.stringify({ data: { answer: '', final: true, reference: {}, thinkingDone: thinkingFinished } })}\n\n`
}

export async function POST(req: NextRequest) {
  const { question, model = 'qwen', webResults, searchQuery } = await req.json() as {
    question: string
    model?: 'qwen' | 'gemma4'
    webResults?: Array<{ title: string; url: string; snippet: string }>
    searchQuery?: string
  }
  if (!question) return NextResponse.json({ error: '请输入问题' }, { status: 400 })
  
  const usedQuery = searchQuery || question
  const safeWebResults = webResults || []
  const webContext = safeWebResults.length > 0
    ? safeWebResults.map((r, idx) => `[${idx + 1}] ${r.title}\n${r.snippet}`).join('\n')
    : ''

  const systemContent = webContext
    ? `你是企业知识库AI助手，已执行联网搜索（关键词：${usedQuery}）。搜索结果如下：\n\n${webContext}\n\n请基于搜索结果回答用户原始问题。规则：结果相关时优先使用并标注引用序号[1][2]；结果不相关时忽略并直接用知识回答说明情况；用自己语言组织回答。`
    : '你是企业知识库AI助手，联网搜索无结果，请直接根据知识回答，并说明信息来自训练数据。'

  const modelName = 'deepseek-v4-flash'
  
  let llmRes: Response
  try {
    llmRes = await fetch(`${LLM_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_API_KEY}` },
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
