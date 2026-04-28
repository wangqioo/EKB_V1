import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')
  if (!query) return NextResponse.json({ error: '缺少搜索关键词' }, { status: 400 })

  try {
    const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(15000),
    })

    if (!r.ok) return NextResponse.json({ error: '搜索请求失败' }, { status: 502 })

    const html = await r.text()
    const results: Array<{ title: string; url: string; snippet: string }> = []

    // Extract result links
    const docRegex = /<a[^>]*href="([^"]*?)"[^>]*>(.*?)<\/a>/g
    let match
    while ((match = docRegex.exec(html)) !== null && results.length < 10) {
      const url = match[1]
      if (url.startsWith('http') && !url.includes('duckduckgo.com')) {
        const title = match[2].replace(/<[^>]*>/g, '').trim()
        // Extract snippet from meta description
        const snippetRegex = /<meta[^>]*name="description"[^>]*content="([^"]*?)"/
        const snipMatch = html.match(snippetRegex)

        // DuckDuckGo uses multiple meta descriptions for different result sets
        // We need to find the one associated with organic results
        if (snipMatch) {
          results.push({ title: title || url, url, snippet: snipMatch[1] })
        } else {
          results.push({ title: title || url, url, snippet: '' })
        }
      }
    }

    return NextResponse.json({ data: results })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '搜索失败'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
