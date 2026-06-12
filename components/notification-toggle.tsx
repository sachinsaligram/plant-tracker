'use client'
import { useState, useEffect } from 'react'

type Status = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

export function NotificationToggle() {
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported'); return
    }
    if (Notification.permission === 'denied') { setStatus('denied'); return }
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => setStatus(sub ? 'subscribed' : 'unsubscribed'))
    )
  }, [])

  async function subscribe() {
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
  }

  if (status === 'loading') return null
  if (status === 'unsupported') return <p className="text-sm text-gray-400">Push not supported on this browser.</p>
  if (status === 'denied') return <p className="text-sm text-red-500">Notifications blocked. Enable in browser settings.</p>
  if (status === 'subscribed') return <p className="text-sm text-green-600">✓ Notifications enabled</p>
  return (
    <button
      onClick={subscribe}
      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
    >
      Enable push notifications
    </button>
  )
}
