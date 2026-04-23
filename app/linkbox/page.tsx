import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import FavoritesClient from './FavoritesClient'

export default async function LinkboxPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return (
    <FavoritesClient
      userName={session.name}
      role={session.role}
      permissionLevel={session.permissionLevel ?? 0}
    />
  )
}
