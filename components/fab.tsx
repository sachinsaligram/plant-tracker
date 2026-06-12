import Link from 'next/link'

export function FAB() {
  return (
    <Link
      href="/plants/new"
      className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-green-600 text-white text-3xl flex items-center justify-center shadow-lg hover:bg-green-700 transition-colors"
      aria-label="Add plant"
    >
      +
    </Link>
  )
}
