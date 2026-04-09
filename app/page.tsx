import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import MainClient from './MainClient'

export default async function HomePage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return <MainClient userId={session.userId} isReadonly={session.role === 'readonly'} />
}

