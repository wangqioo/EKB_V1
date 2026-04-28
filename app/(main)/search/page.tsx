import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SearchClient from './SearchClient'

export default async function SearchPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return <SearchClient userName={session.name} role={session.role} permissionLevel={session.permissionLevel ?? 0} />
}
