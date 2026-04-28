import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SharedClient from './SharedClient'

export default async function SharedPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return <SharedClient userId={session.id} userName={session.name} role={session.role} permissionLevel={session.permissionLevel ?? 0} />
}
