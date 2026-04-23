import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ChatClient from './ChatClient'

export default async function ChatPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return <ChatClient userId={session.id} userName={session.name} role={session.role} permissionLevel={session.permissionLevel ?? 0} />
}
