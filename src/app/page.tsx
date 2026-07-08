'use client'

import { useEffect, useState } from 'react'
import { Guest, loadGuest, saveGuest } from '@/lib/client/guest'
import NameForm from '@/components/NameForm'
import CameraScreen from '@/components/CameraScreen'

export default function Home() {
  const [guest, setGuest] = useState<Guest | null | undefined>(undefined)
  useEffect(() => setGuest(loadGuest()), [])

  if (guest === undefined) return null
  if (!guest) return <NameForm onDone={(g) => { saveGuest(g); setGuest(g) }} />
  return <CameraScreen guest={guest} />
}
