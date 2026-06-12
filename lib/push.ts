import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

type PushSub = { endpoint: string; p256dh: string; auth: string }
type PushPayload = { title: string; body: string; url: string }

export async function sendPush(sub: PushSub, payload: PushPayload): Promise<void> {
  await webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload)
  )
}
