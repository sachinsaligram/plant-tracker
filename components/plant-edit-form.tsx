'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Plant = {
  id: string
  common_name: string
  scientific_name: string | null
  location: string
  soil_type: string | null
  watering_interval_days: number
  repotting_interval_days: number
  fertilizing_interval_days: number
  notes: string | null
}

const SOIL_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'potting mix', label: '🪨 Potting Mix' },
  { value: 'cactus mix', label: '🌵 Cactus Mix' },
  { value: 'orchid mix', label: '🌸 Orchid Mix' },
  { value: 'custom', label: '✨ Custom Mix' },
]

const LOCATION_OPTIONS = [
  { value: 'indoor', label: '🏠 Indoor' },
  { value: 'outdoor', label: '🌳 Outdoor' },
  { value: 'balcony', label: '🌿 Balcony' },
  { value: 'greenhouse', label: '🏡 Greenhouse' },
]

export function PlantEditForm({ plant }: { plant: Plant }) {
  const router = useRouter()
  const [form, setForm] = useState({
    common_name: plant.common_name,
    scientific_name: plant.scientific_name ?? '',
    location: plant.location,
    soil_type: plant.soil_type ?? '',
    watering_interval_days: plant.watering_interval_days,
    repotting_interval_days: plant.repotting_interval_days,
    fertilizing_interval_days: plant.fertilizing_interval_days,
    notes: plant.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!form.common_name.trim()) return
    setSaving(true)
    setError(null)
    const body: Record<string, unknown> = {
      common_name: form.common_name.trim(),
      scientific_name: form.scientific_name.trim() || null,
      location: form.location,
      watering_interval_days: form.watering_interval_days,
      repotting_interval_days: form.repotting_interval_days,
      fertilizing_interval_days: form.fertilizing_interval_days,
      notes: form.notes.trim() || null,
    }
    if (form.soil_type) body.soil_type = form.soil_type

    const res = await fetch(`/api/plants/${plant.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      router.push(`/plants/${plant.id}`)
      router.refresh()
    } else {
      setError('Save failed. Please try again.')
    }
  }

  const field = (label: string, children: React.ReactNode) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      {children}
    </label>
  )

  const input = (key: keyof typeof form, type = 'text') => (
    <input
      type={type}
      className="border border-gray-200 rounded-xl px-3 py-3 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
      value={form[key] as string | number}
      onChange={e => setForm({ ...form, [key]: type === 'number' ? Math.max(1, +e.target.value) : e.target.value })}
    />
  )

  return (
    <div className="flex flex-col gap-4 p-4 pb-32 max-w-lg mx-auto w-full">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Plant Info</h2>
        {field('Common name', input('common_name'))}
        {field('Scientific name', input('scientific_name'))}
        {field('Location',
          <select
            className="border border-gray-200 rounded-xl px-3 py-3 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            value={form.location}
            onChange={e => setForm({ ...form, location: e.target.value })}
          >
            {LOCATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        {field('Soil type',
          <select
            className="border border-gray-200 rounded-xl px-3 py-3 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            value={form.soil_type}
            onChange={e => setForm({ ...form, soil_type: e.target.value })}
          >
            {SOIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        {field('Notes',
          <textarea
            className="border border-gray-200 rounded-xl px-3 py-3 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
            rows={3}
            placeholder="Anything you want to remember about this plant…"
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
          />
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Care Schedule</h2>
        {[
          { label: '💧 Water every (days)', key: 'watering_interval_days' as const },
          { label: '🪴 Repot every (days)', key: 'repotting_interval_days' as const },
          { label: '🌱 Feed every (days)', key: 'fertilizing_interval_days' as const },
        ].map(({ label, key }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm text-gray-700">{label}</span>
            <input
              type="number"
              min="1"
              className="w-20 border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-900 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-400"
              value={form[key]}
              onChange={e => setForm({ ...form, [key]: Math.max(1, +e.target.value) })}
            />
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t safe-area-bottom">
        <button
          onClick={handleSave}
          disabled={saving || !form.common_name.trim()}
          className="w-full max-w-lg mx-auto block bg-green-600 text-white rounded-2xl py-4 font-semibold text-base disabled:opacity-50 hover:bg-green-700 active:scale-95 transition-all"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
