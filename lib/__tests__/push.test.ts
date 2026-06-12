import { sendPush } from '@/lib/push'
import webpush from 'web-push'

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue(undefined),
}))

const mockWebpush = webpush as jest.Mocked<typeof webpush>

describe('sendPush', () => {
  it('calls sendNotification with the correct subscription shape', async () => {
    const sub = { endpoint: 'https://push.example.com', p256dh: 'key123', auth: 'secret456' }
    await sendPush(sub, { title: 'Water Monstera', body: 'Time to water!', url: '/plants/p1' })
    expect(mockWebpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title: 'Water Monstera', body: 'Time to water!', url: '/plants/p1' })
    )
  })
})
