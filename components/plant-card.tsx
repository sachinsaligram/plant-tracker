import Link from 'next/link'
import Image from 'next/image'

type Plant = {
  id: string
  common_name: string
  scientific_name?: string | null
  next_watering_at?: string | null
  primary_photo?: string | null
}

export function PlantCard({ plant }: { plant: Plant }) {
  const nextWater = plant.next_watering_at
    ? new Date(plant.next_watering_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    : null

  return (
    <Link href={`/plants/${plant.id}`} className="flex gap-4 p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-green-50 flex-shrink-0">
        {plant.primary_photo ? (
          <Image src={plant.primary_photo} alt={plant.common_name} width={64} height={64} className="object-cover w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl" aria-hidden>🌿</div>
        )}
      </div>
      <div className="flex flex-col justify-center">
        <p className="font-semibold text-gray-900">{plant.common_name}</p>
        {plant.scientific_name && <p className="text-xs text-gray-500 italic">{plant.scientific_name}</p>}
        {nextWater && <p className="text-xs text-blue-600 mt-1">Water by {nextWater}</p>}
      </div>
    </Link>
  )
}
