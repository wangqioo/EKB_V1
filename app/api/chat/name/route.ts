import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { firstMessage } = await req.json()
  if (!firstMessage) return NextResponse.json({ name: '新对话' })

  try {
    const r = await fetch('http://localhost:8086/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'Qwen2.5-VL-3B',
        messages: [
          {
            role: 'system',
            content: '你是标题生成助手。请用不超过10个汉字为用户的问题生成一个简洁标题，只输出标题本身，不加任何解释、标点或引号。',
          },
          { role: 'user', content: firstMessage },
        ],
        max_tokens: 20,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (r.ok) {
      const d = await r.json()
      const name = d.choices?.[0]?.message?.content?.trim()
      if (name && name.length > 0 && name.length <= 20) {
        return NextResponse.json({ name })
      }
    }
  } catch {
    // fall through to truncation
  }

  const name = firstMessage.length > 16 ? firstMessage.slice(0, 16) + '…' : firstMessage
  return NextResponse.json({ name })
}
