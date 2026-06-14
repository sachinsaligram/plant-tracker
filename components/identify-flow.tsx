'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type PlantData = {
  common_name: string
  scientific_name: string
  watering_interval_days: number
  repotting_interval_days: number
  fertilizing_interval_days: number
  suggested_soil_type: string
  location_preference: string
}

type Step = 'capture' | 'confirm' | 'saving'

export function IdentifyFlow() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('capture')
  const [preview, setPreview] = useState<string | null>(null)
  const [form, setForm] = useState<PlantData | null>(null)
  const [identifying, setIdentifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      setPreview(dataUrl)
      setIdentifying(true)
      setError(null)
      try {
        const res = await fetch('/api/identify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl }),
        })
        if (!res.ok) throw new Error('Identification failed')
        const data: PlantData = await res.json()
        setForm(data)
        setStep('confirm')
      } catch {
        setError('Could not identify the plant. Please try a clearer photo.')
        setPreview(null)
      } finally {
        setIdentifying(false)
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!form || !preview) return
    setStep('saving')

    const plantRes = await fetch('/api/plants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        common_name: form.common_name,
        scientific_name: form.scientific_name,
        location: form.location_preference,
        soil_type: form.suggested_soil_type,
        watering_interval_days: form.watering_interval_days,
        repotting_interval_days: form.repotting_interval_days,
        fertilizing_interval_days: form.fertilizing_interval_days,
      }),
    })
    if (!plantRes.ok) { setStep('confirm'); return }
    const plant = await plantRes.json()

    const blob = await fetch(preview).then(r => r.blob())
    const fd = new FormData()
    fd.append('plant_id', plant.id)
    fd.append('file', blob, 'photo.jpg')
    fd.append('is_primary', 'true')
    await fetch('/api/photos', { method: 'POST', body: fd })

    router.push(`/plants/${plant.id}`)
  }

  if (step === 'capture') {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
          <span className="text-2xl">🪴</span>
          <h1 className="text-xl font-bold text-gray-900">Add a Plant</h1>
        </div>

        <div className="flex flex-col items-center gap-6 p-6 pt-12">
          {error && (
            <div className="w-full max-w-sm bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {identifying ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-6xl animate-bounce">🔍</div>
              <p className="text-gray-600 font-medium">Identifying your plant…</p>
              <p className="text-gray-400 text-sm text-center">Claude is analysing the photo</p>
              {preview && (
                <img src={preview} alt="preview" className="w-40 h-40 object-cover rounded-3xl shadow-md opacity-80" />
              )}
            </div>
          ) : (
            <>
              <p className="text-gray-500 text-sm text-center leading-relaxed max-w-xs">
                Take a photo or upload from your gallery. Claude will identify it and create a care schedule.
              </p>
              <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                <label
                  htmlFor="photo-camera"
                  className="cursor-pointer flex flex-col items-center gap-3 border-2 border-dashed border-green-300 rounded-3xl p-8 bg-white hover:border-green-500 hover:bg-green-50 transition-colors active:scale-95"
                >
                  <span className="text-5xl">📷</span>
                  <span className="font-semibold text-green-700 text-sm text-center">Take a photo</span>
                  <input
                    id="photo-camera"
                    type="file"
                    accept="image/*"
                    capture={"environment" as any}
                    className="sr-only"
                    onChange={handleFile}
                  />
                </label>
                <label
                  htmlFor="photo-gallery"
                  className="cursor-pointer flex flex-col items-center gap-3 border-2 border-dashed border-green-300 rounded-3xl p-8 bg-white hover:border-green-500 hover:bg-green-50 transition-colors active:scale-95"
                >
                  <span className="text-5xl">🖼️</span>
                  <span className="font-semibold text-green-700 text-sm text-center">From gallery</span>
                  <input
                    id="photo-gallery"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleFile}
                  />
                </label>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  if (step === 'confirm' && form) {
    const textFields = [
      { label: 'Common name', key: 'common_name', type: 'text' },
      { label: 'Scientific name', key: 'scientific_name', type: 'text' },
    ] as const

    const numberFields = [
      { label: 'Water every (days)', key: 'watering_interval_days', emoji: '💧' },
      { label: 'Repot every (days)', key: 'repotting_interval_days', emoji: '🪴' },
      { label: 'Fertilize every (days)', key: 'fertilizing_interval_days', emoji: '🌱' },
    ] as const

    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
          <button onClick={() => { setStep('capture'); setPreview(null) }} className="text-green-600 text-sm font-medium">← Back</button>
          <h1 className="text-xl font-bold text-gray-900">Confirm Details</h1>
        </div>

        <div className="flex flex-col gap-4 p-4 pb-32 max-w-lg mx-auto w-full">
          {preview && (
            <img src={preview} alt="plant" className="w-full h-52 object-cover rounded-3xl shadow-sm" />
          )}

          <div className="bg-white rounded-3xl shadow-sm p-5 flex flex-col gap-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Plant Info</h2>
            {textFields.map(({ label, key, type }) => (
              <label key={key} className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-500">{label}</span>
                <input
                  type={type}
                  className="border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  value={(form as any)[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                />
              </label>
            ))}

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-500">Location</span>
              <select
                className="border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                value={form.location_preference}
                onChange={e => setForm({ ...form, location_preference: e.target.value })}
              >
                <option value="indoor">🏠 Indoor</option>
                <option value="outdoor">🌳 Outdoor</option>
                <option value="balcony">🌿 Balcony</option>
                <option value="greenhouse">🏡 Greenhouse</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-500">Soil type</span>
              <select
                className="border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                value={form.suggested_soil_type}
                onChange={e => setForm({ ...form, suggested_soil_type: e.target.value })}
              >
                <option value="potting mix">🪨 Potting Mix</option>
                <option value="cactus mix">🌵 Cactus Mix</option>
                <option value="orchid mix">🌸 Orchid Mix</option>
                <option value="custom">✨ Custom Mix</option>
              </select>
            </label>
          </div>

          <div className="bg-white rounded-3xl shadow-sm p-5 flex flex-col gap-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Care Schedule</h2>
            {numberFields.map(({ label, key, emoji }) => (
              <label key={key} className="flex items-center gap-3">
                <span className="text-2xl w-8 text-center">{emoji}</span>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <input
                    type="number"
                    min="1"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    value={(form as any)[key]}
                    onChange={e => setForm({ ...form, [key]: Math.max(1, +e.target.value) })}
                  />
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <button
            onClick={handleSave}
            className="w-full max-w-lg mx-auto block bg-green-600 text-white rounded-2xl py-4 font-semibold text-base hover:bg-green-700 active:scale-95 transition-all"
          >
            Save Plant 🌿
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="text-6xl animate-bounce">🌱</div>
      <p className="text-gray-600 font-medium animate-pulse">Saving your plant…</p>
    </div>
  )
}
