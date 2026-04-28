import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="h-dvh flex" style={{ background: 'var(--bg-base)' }}>
      <Sidebar userName={session.name} role={session.role} permissionLevel={session.permissionLevel ?? 0} />
      {children}
    </div>
  )
}
