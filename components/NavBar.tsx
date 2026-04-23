'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export default function NavBar({ userName }: { userName: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-bold text-slate-800 text-lg">企业知识库</span>
        <Link href="/library" className={`text-sm font-medium px-3 py-1 rounded-lg transition ${pathname === '/library' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
          📚 知识库
        </Link>
        <Link href="/chat" className={`text-sm font-medium px-3 py-1 rounded-lg transition ${pathname === '/chat' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
          💬 智能问答
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500">{userName}</span>
        <button onClick={handleLogout} className="text-sm text-slate-400 hover:text-red-500 transition">退出</button>
      </div>
    </nav>
  )
}
