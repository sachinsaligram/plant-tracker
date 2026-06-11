import { signIn } from '@/lib/auth'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-green-50">
      <form
        action={async () => {
          'use server'
          await signIn('google', { redirectTo: '/' })
        }}
      >
        <button
          type="submit"
          className="rounded-lg bg-green-600 px-6 py-3 text-white font-medium hover:bg-green-700"
        >
          Sign in with Google
        </button>
      </form>
    </main>
  )
}
