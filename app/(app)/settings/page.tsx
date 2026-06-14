import { auth, signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { NotificationToggle } from '@/components/notification-toggle'

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const initials = (session.user.name ?? session.user.email ?? 'U')
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-green-600 to-emerald-700 px-4 pt-6 pb-8">
        <Link href="/" className="text-white/80 text-sm font-medium">‹ Back</Link>
        <h1 className="text-2xl font-bold text-white mt-2">Settings</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 pb-24 flex flex-col gap-4">

        {/* Profile card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-xl shadow-sm flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 truncate">{session.user.name ?? 'Plant Lover'}</p>
              <p className="text-sm text-gray-500 truncate">{session.user.email}</p>
            </div>
          </div>
          <div className="border-t border-gray-50 px-5 py-3">
            <form
              action={async () => {
                'use server'
                await signOut({ redirectTo: '/login' })
              }}
            >
              <button type="submit" className="text-sm text-red-500 font-medium hover:text-red-600 flex items-center gap-1.5">
                <span>→</span> Sign out
              </button>
            </form>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 pt-5 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🔔</span>
              <h2 className="font-bold text-gray-900">Push Notifications</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">Care reminders sent directly to your device</p>
            <NotificationToggle />
          </div>
          <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/50">
            <p className="text-xs text-gray-400 leading-relaxed">
              Notifications are sent daily at 8 AM for any plants that need care that day or are overdue.
            </p>
          </div>
        </div>

        {/* About */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🌿</span>
              <h2 className="font-bold text-gray-900">About Plant Tracker</h2>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Powered by</span>
                <span className="font-medium text-gray-800">Claude AI (Anthropic)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Photos stored</span>
                <span className="font-medium text-gray-800">Vercel Blob</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Database</span>
                <span className="font-medium text-gray-800">Turso (libSQL)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
          <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">Tips</p>
          <ul className="text-xs text-green-800 leading-relaxed flex flex-col gap-1.5">
            <li>• Tap any plant → Timeline to log care with optional notes and fertilizer details</li>
            <li>• After repotting, select the new soil type to update your plant's profile</li>
            <li>• Use "Ask Claude" on any plant for personalized care advice</li>
            <li>• Add to Home Screen for the best experience on mobile</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
