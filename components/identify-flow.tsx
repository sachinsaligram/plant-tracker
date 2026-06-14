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
        setError('Could not identify plant. Please try again.')
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
      <div className="flex flex-col items-center gap-6 p-8">
        <h1 className="text-xl font-bold">Add a Plant</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {identifying ? (
          <p className="text-gray-500 animate-pulse">Identifying plant...</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            <label
              htmlFor="photo-camera"
              className="cursor-pointer flex flex-col items-center gap-3 border-2 border-dashed border-green-400 rounded-2xl p-8 text-green-600 hover:border-green-600"
            >
              <span className="text-4xl" aria-hidden>📷</span>
              <span className="font-medium text-sm text-center">Take a photo</span>
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
              className="cursor-pointer flex flex-col items-center gap-3 border-2 border-dashed border-green-400 rounded-2xl p-8 text-green-600 hover:border-green-600"
            >
              <span className="text-4xl" aria-hidden>🖼️</span>
              <span className="font-medium text-sm text-center">Choose from gallery</span>
              <input
                id="photo-gallery"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFile}
              />
            </label>
          </div>
        )}
        {preview && <img src={preview} alt="preview" className="w-40 h-40 object-cover rounded-xl" />}
      </div>
    )
  }

  if (step === 'confirm' && form) {
    return (
      <div className="flex flex-col gap-4 p-6 max-w-md mx-auto">
        <h1 className="text-xl font-bold">Confirm Plant Details</h1>
        {preview && <img src={preview} alt="plant" className="w-full h-48 object-cover rounded-2xl" />}
        {[
          { label: 'Common name', key: 'common_name', type: 'text' },
          { label: 'Scientific name', key: 'scientific_name', type: 'text' },
          { label: 'Water every (days)', key: 'watering_interval_days', type: 'number' },
          { label: 'Repot every (days)', key: 'repotting_interval_days', type: 'number' },
          { label: 'Fertilize every (days)', key: 'fertilizing_interval_days', type: 'number' },
        ].map(({ label, key, type }) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">{label}</span>
            <input
              type={type}
              className="border rounded-lg px-3 py-2"
              value={(form as any)[key]}
              onChange={e => setForm({ ...form, [key]: type === 'number' ? +e.target.value : e.target.value })}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Location</span>
          <select
            className="border rounded-lg px-3 py-2"
            value={form.location_preference}
            onChange={e => setForm({ ...form, location_preference: e.target.value })}
          >
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
            <option value="balcony">Balcony</option>
            <option value="greenhouse">Greenhouse</option>
          </select>
        </label>
        <button onClick={handleSave} className="mt-2 bg-green-600 text-white rounded-xl py-3 font-semibold hover:bg-green-700">
          Save Plant
        </button>
      </div>
    )
  }

  return <p className="text-center text-gray-500 mt-16 animate-pulse">Saving...</p>
}
