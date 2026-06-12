import { put } from '@vercel/blob'

export async function uploadPhoto(file: File, userId: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const { url } = await put(`plants/${userId}/${Date.now()}.${ext}`, file, { access: 'public' })
  return url
}
