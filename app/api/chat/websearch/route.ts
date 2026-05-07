import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export interface SearchResult { title: string; url: string; snippet: string }

// ── Query preprocessing ────────────────────────────────────────────────────
function extractSearchQuery(question: string): string {
  let q = question.trim()
  const prefixes = [
    /^什么是\s*/, /^什么叫\s*/, /^什么叫做\s*/,
    /^请介绍\s*/, /^介绍一下\s*/, /^介绍下\s*/,
    /^告诉我\s*/, /^帮我了解\s*/, /^我想知道\s*/,
    /^请问\s*/, /^请简介\s*/, /^简介\s*/,
    /^如何\s*/, /^怎么\s*/, /^怎样\s*/,
    /^为什么\s*/, /^为何\s*/,
    /^有没有\s*/, /^能不能\s*/,
  ]
  for (const re of prefixes) {
    const cleaned = q.replace(re, '').trim()
    if (cleaned.length >= 2) { q = cleaned; break }
  }
  q = q.replace(/[？?！!。.，,；;]+$/, '').trim()
  return q.length >= 2 ? q : question.trim()
}

// ── Relevance scoring ──────────────────────────────────────────────────────
function scoreRelevance(results: SearchResult[], query: string): number {
  if (results.length === 0) return 0
  // Extract 2-char+ segments as keywords
  const segs = query.split(/[\s,，。.！!？?；;]+/).filter(s => s.length >= 2)
  if (segs.length === 0) return 1
  let hits = 0
  for (const r of results) {
    const text = (r.title + ' ' + r.snippet).toLowerCase()
    if (segs.some(s => text.includes(s.toLowerCase()))) hits++
  }
  return hits / results.length
}

// ── Bing HTML scraper ─────────────────────────────────────────────────────
async function searchBing(query: string): Promise<SearchResult[]> {
  const url = `https://cn.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-CN&cc=CN`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'identity',
    },
    signal: AbortSignal.timeout(12000),
  })
  const html = await res.text()
  const results: SearchResult[] = []

  const blockRe = /<li[^>]*class="[^"]*b_algo[^"]*"[^>]*>([\s\S]*?)<\/li>/g
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(html)) !== null && results.length < 6) {
    const block = m[1]
    const titleM = block.match(/<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/)
    // Try multiple snippet selectors
    const snippetM = block.match(/<p[^>]*class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/)
      || block.match(/<p[^>]*>([\s\S]*?)<\/p>/)
      || block.match(/<div[^>]*class="[^"]*b_snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/)
    if (titleM) {
      const url = titleM[1]
      const title = titleM[2].replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#\d+;/g, '').replace(/&nbsp;/g, ' ').trim()
      const snippet = snippetM
        ? snippetM[1].replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&').replace(/&ensp;/g, ' ').replace(/&#\d+;/g, '')
            .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
        : ''
      if (title && url.startsWith('http')) {
        results.push({ title, url, snippet: snippet.slice(0, 400) })
      }
    }
  }
  return results
}

// ── Sogou HTML scraper (fallback for China) ────────────────────────────────
async function searchSogou(query: string): Promise<SearchResult[]> {
  const url = `https://www.sogou.com/web?query=${encodeURIComponent(query)}&ie=utf8`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(10000),
  })
  const html = await res.text()
  const results: SearchResult[] = []

  // Sogou results: <div class="vrwrap"> or <div class="rb">
  const blockRe = /<div[^>]*class="[^"]*(?:vrwrap|rb)[^"]*"[^>]*>([\s\S]*?)<\/div>/g
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(html)) !== null && results.length < 6) {
    const block = m[1]
    const titleM = block.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/)
    const snippetM = block.match(/<p[^>]*class="[^"]*(?:str_info|star-wiki|str-text)[^"]*"[^>]*>([\s\S]*?)<\/p>/)
      || block.match(/<div[^>]*class="[^"]*space-txt[^"]*"[^>]*>([\s\S]*?)<\/div>/)
    if (titleM) {
      const url = titleM[1]
      const title = titleM[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&\w+;/g, ' ').replace(/<em>/g, '').replace(/<\/em>/g, '').trim()
      const snippet = snippetM
        ? snippetM[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&\w+;/g, ' ').replace(/\s+/g, ' ').replace(/<em>/g, '').replace(/<\/em>/g, '').trim()
        : ''
      if (title && url.startsWith('http')) {
        results.push({ title, url, snippet: snippet.slice(0, 400) })
      }
    }
  }
  return results
}

// ── Main handler ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = req.nextUrl.searchParams.get('q')?.trim()
  if (!raw) return NextResponse.json({ error: '缺少查询词' }, { status: 400 })

  const searchQuery = extractSearchQuery(raw)

  try {
    let results = await searchBing(searchQuery)

    // Fallback to Sogou if Bing returns no results
    if (results.length === 0) {
      results = await searchSogou(searchQuery)
    }

    // If results are poor, retry with original raw query (in case preprocessing was wrong)
    if (scoreRelevance(results, searchQuery) < 0.3 && searchQuery !== raw) {
      const rawResults = results.length === 0 ? await searchSogou(raw) : await searchBing(raw)
      if (scoreRelevance(rawResults, searchQuery) > scoreRelevance(results, searchQuery)) {
        results = rawResults
      }
    }

    // Filter out clearly irrelevant results (0 keyword overlap)
    const segs = searchQuery.split(/[\s,，。.！!？?；;]+/).filter(s => s.length >= 2)
    if (segs.length > 0) {
      const filtered = results.filter(r => {
        const text = (r.title + ' ' + r.snippet).toLowerCase()
        return segs.some(s => text.includes(s.toLowerCase()))
      })
      if (filtered.length >= 2) results = filtered
    }

    return NextResponse.json({ results, query: searchQuery, originalQuery: raw })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '搜索失败'
    return NextResponse.json({ results: [], query: searchQuery, error: msg })
  }
}
