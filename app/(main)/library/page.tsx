import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LibraryClient from './LibraryClient'

export default async function LibraryPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return <LibraryClient userName={session.name} role={session.role} permissionLevel={session.permissionLevel ?? 0} />
}
