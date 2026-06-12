import Image from 'next/image'

type Photo = { id: string; blob_url: string; taken_at: string }

export function PhotoTimeline({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) return null
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {photos.map(photo => (
        <div key={photo.id} className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-gray-100">
          <Image src={photo.blob_url} alt="" width={96} height={96} className="object-cover w-full h-full" />
        </div>
      ))}
    </div>
  )
}
