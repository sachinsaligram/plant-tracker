import Link from 'next/link'
import Image from 'next/image'

type Plant = {
  id: string
  common_name: string
  scientific_name?: string | null
  next_watering_at?: string | null
  next_repotting_at?: string | null
  next_fertilizing_at?: string | null
  primary_photo?: string | null
}

function urgencyDays(d: string | null | undefined): number | null {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
}

function careChip(emoji: string, days: number | null) {
  if (days === null) return null
  const overdue = days < 0
  const soon = days <= 1
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        overdue
          ? 'bg-red-100 text-red-700'
          : soon
          ? 'bg-amber-100 text-amber-700'
          : 'bg-gray-100 text-gray-500'
      }`}
    >
      {emoji}
      {overdue
        ? `${Math.abs(days)}d late`
        : days === 0
        ? 'today'
        : days === 1
        ? 'tomorrow'
        : `${days}d`}
    </span>
  )
}

export function PlantCard({ plant }: { plant: Plant }) {
  const waterDays = urgencyDays(plant.next_watering_at)
  const repotDays = urgencyDays(plant.next_repotting_at)
  const fertDays = urgencyDays(plant.next_fertilizing_at)

  const isUrgent =
    (waterDays !== null && waterDays <= 0) ||
    (repotDays !== null && repotDays <= 0) ||
    (fertDays !== null && fertDays <= 0)
  const isSoon =
    !isUrgent &&
    ((waterDays !== null && waterDays <= 1) ||
      (repotDays !== null && repotDays <= 1) ||
      (fertDays !== null && fertDays <= 1))

  return (
    <Link
      href={`/plants/${plant.id}`}
      className={`flex gap-4 p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border ${
        isUrgent ? 'border-red-200' : isSoon ? 'border-amber-200' : 'border-transparent'
      }`}
    >
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-green-50 flex-shrink-0">
        {plant.primary_photo ? (
          <Image src={plant.primary_photo} alt={plant.common_name} width={64} height={64} className="object-cover w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl" aria-hidden>🌿</div>
        )}
      </div>
      <div className="flex flex-col justify-center gap-1.5 min-w-0">
        <div>
          <p className="font-semibold text-gray-900 truncate">{plant.common_name}</p>
          {plant.scientific_name && <p className="text-xs text-gray-500 italic truncate">{plant.scientific_name}</p>}
        </div>
        <div className="flex flex-wrap gap-1">
          {careChip('💧', waterDays)}
          {repotDays !== null && repotDays <= 7 && careChip('🪴', repotDays)}
          {fertDays !== null && fertDays <= 7 && careChip('🌱', fertDays)}
        </div>
      </div>
    </Link>
  )
}
