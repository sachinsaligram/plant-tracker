import { auth, signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { NotificationToggle } from '@/components/notification-toggle'

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <Link href="/" className="text-green-600 text-sm mb-4 block">← Back</Link>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <section className="bg-white rounded-2xl shadow-sm p-6 mb-4">
        <h2 className="font-semibold mb-1">{session.user.name ?? ''}</h2>
        <p className="text-sm text-gray-500 mb-4">{session.user.email}</p>
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/login' })
          }}
        >
          <button type="submit" className="text-sm text-red-500 hover:underline">
            Sign out
          </button>
        </form>
      </section>

      <section className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold mb-3">Notifications</h2>
        <NotificationToggle />
      </section>
    </main>
  )
}
