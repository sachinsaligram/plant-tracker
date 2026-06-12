import { signIn } from '@/lib/auth'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white px-6">
      <div className="flex flex-col items-center gap-6 text-center max-w-xs">
        <div className="text-7xl">🌿</div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Plant Tracker</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Photograph your plants, get AI care tips, and never forget to water again.
          </p>
        </div>
        <form
          action={async () => {
            'use server'
            await signIn('google', { redirectTo: '/' })
          }}
          className="w-full"
        >
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-white border border-gray-200 px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <g fill="none" fillRule="evenodd">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </g>
            </svg>
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  )
}
