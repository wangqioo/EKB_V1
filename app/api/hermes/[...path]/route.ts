import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'

const HERMES_BASE = 'http://localhost:8642'
const HERMES_KEY = process.env.HERMES_API_KEY || 'hermes-secret-key'

function buildUpstreamHeaders(req: NextRequest): Headers {
  const headers = new Headers()
  const ct = req.headers.get('content-type')
  if (ct) headers.set('content-type', ct)
  const accept = req.headers.get('accept')
  if (accept) headers.set('accept', accept)
  const sessionId = req.headers.get('x-hermes-session-id')
  if (sessionId) headers.set('x-hermes-session-id', sessionId)
  headers.set('authorization', `Bearer ${HERMES_KEY}`)
  return headers
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const user = await getSession()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { path } = await params
  const pathStr = path.join('/')
  const search = req.nextUrl.search
  const url = `${HERMES_BASE}/${pathStr}${search}`

  try {
    const upstream = await fetch(url, {
      headers: buildUpstreamHeaders(req),
      signal: req.signal,
    })
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'no-cache',
        'x-hermes-session-id': upstream.headers.get('x-hermes-session-id') || '',
      },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: { 'content-type': 'application/json' } })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const user = await getSession()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { path } = await params
  const pathStr = path.join('/')
  const url = `${HERMES_BASE}/${pathStr}`

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: buildUpstreamHeaders(req),
      body: req.body,
      // @ts-ignore
      duplex: 'half',
      signal: req.signal,
    })

    const isSSE = (upstream.headers.get('content-type') || '').includes('text/event-stream')

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'no-cache',
        ...(isSSE ? { 'connection': 'keep-alive', 'x-accel-buffering': 'no' } : {}),
        'x-hermes-session-id': upstream.headers.get('x-hermes-session-id') || '',
      },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: { 'content-type': 'application/json' } })
  }
}
