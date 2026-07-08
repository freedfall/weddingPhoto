'use client'

import { Guest } from '@/lib/client/guest'

export default function CameraScreen({ guest }: { guest: Guest }) {
  return <p>Привет, {guest.name}! Камера появится в следующей задаче.</p>
}
