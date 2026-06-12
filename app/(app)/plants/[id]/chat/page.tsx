import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChatInterface } from '@/components/chat-interface'

type Params = { params: { id: string } }

export default async function ChatPage({ params }: Params) {
  const session = await auth()
  if (!session) redirect('/login')

  const db = getDb()
  const result = await db.execute({
    sql: 'SELECT * FROM plants WHERE id = ? AND user_id = ?',
    args: [params.id, session.user.id],
  })
  const plant = result.rows[0]
  if (!plant) redirect('/')

  return (
    <main className="flex flex-col h-screen max-w-lg mx-auto">
      <header className="border-b px-4 py-3 flex items-center gap-3">
        <Link href={`/plants/${params.id}`} className="text-green-600 text-sm">← Back</Link>
        <h1 className="font-semibold">{plant.common_name as string}</h1>
      </header>
      <ChatInterface plantId={params.id} />
    </main>
  )
}
