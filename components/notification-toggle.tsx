'use client'
import { useState, useEffect } from 'react'

type Status = 'loading' | 'unsupported' | 'needs-home-screen' | 'denied' | 'subscribed' | 'unsubscribed'

function detectPlatform() {
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  return { isIOS, isStandalone }
}

export function NotificationToggle() {
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      const { isIOS, isStandalone } = detectPlatform()
      setStatus(isIOS && !isStandalone ? 'needs-home-screen' : 'unsupported')
      return
    }
    if (Notification.permission === 'denied') { setStatus('denied'); return }
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => setStatus(sub ? 'subscribed' : 'unsubscribed'))
    )
  }, [])

  async function subscribe() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      })
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      setStatus('subscribed')
    } catch {
      setStatus('denied')
    }
  }

  if (status === 'loading') return <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />

  if (status === 'subscribed') {
    return (
      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
        <span className="text-2xl">✅</span>
        <div>
          <p className="text-sm font-semibold text-green-800">Notifications enabled</p>
          <p className="text-xs text-green-600 mt-0.5">You'll get daily reminders for plant care</p>
        </div>
      </div>
    )
  }

  if (status === 'needs-home-screen') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
        <span className="text-2xl flex-shrink-0">📲</span>
        <div>
          <p className="text-sm font-semibold text-blue-800">Add to Home Screen first</p>
          <p className="text-xs text-blue-600 mt-1 leading-relaxed">
            iOS requires this app to be installed as a PWA. In Safari, tap the{' '}
            <strong>Share button</strong> (⬆) and select{' '}
            <strong>"Add to Home Screen"</strong>. Then re-open from your home screen.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
        <span className="text-2xl flex-shrink-0">🚫</span>
        <div>
          <p className="text-sm font-semibold text-red-800">Notifications blocked</p>
          <p className="text-xs text-red-600 mt-1 leading-relaxed">
            Go to your browser settings → Site permissions → Notifications and allow this site.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'unsupported') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex gap-3">
        <span className="text-2xl flex-shrink-0">📵</span>
        <div>
          <p className="text-sm font-semibold text-gray-700">Not supported on this browser</p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Push notifications work in Chrome (Android/Desktop), Firefox, and Safari on macOS/iOS 16.4+.
          </p>
        </div>
      </div>
    )
  }

  // unsubscribed
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-500 leading-relaxed">
        Get daily reminders when your plants need watering, feeding, or repotting.
      </p>
      <button
        onClick={subscribe}
        className="w-full bg-green-600 text-white rounded-2xl py-3.5 font-bold text-sm hover:bg-green-700 active:scale-95 transition-all shadow-sm"
      >
        🔔 Enable Push Notifications
      </button>
    </div>
  )
}
