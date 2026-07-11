import { beforeEach, describe, expect, it } from 'vitest'
import { developSet, _resetDevelopTracker } from '@/lib/client/develop'

describe('developSet', () => {
  beforeEach(() => _resetDevelopTracker())

  it('первый вызов задаёт базовую линию и ничего не проявляет', () => {
    expect(developSet(['a', 'b']).size).toBe(0)
  })

  it('id, появившиеся после первого вызова, попадают в набор проявки', () => {
    developSet(['a', 'b'])
    expect([...developSet(['a', 'b', 'c'])]).toEqual(['c'])
  })

  it('набор накапливается и стабилен между вызовами', () => {
    developSet(['a'])
    developSet(['a', 'b'])
    const s = developSet(['a', 'b', 'c'])
    expect([...s].sort()).toEqual(['b', 'c'])
    // повторный вызов с теми же id не меняет набор
    expect([...developSet(['a', 'b', 'c'])].sort()).toEqual(['b', 'c'])
  })

  it('идемпотентен при двойном первом вызове (StrictMode)', () => {
    developSet(['a'])
    expect(developSet(['a']).size).toBe(0)
  })
})
