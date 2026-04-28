import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import TrainingClient from './TrainingClient'

export default async function TrainingPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return (
    <TrainingClient
      userName={session.name}
      role={session.role}
      userId={session.id}
      permissionLevel={session.permissionLevel ?? 0}
    />
  )
}
