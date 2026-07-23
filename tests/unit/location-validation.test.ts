import { describe, it, expect } from 'vitest'
import { locationSchema } from '@/lib/validators/location'

describe('locationSchema', () => {
  it('accepts a valid location and trims a padded cityLabel', () => {
    const result = locationSchema.safeParse({
      latitude: 40.7128,
      longitude: -74.006,
      cityLabel: '  New York, NY  ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cityLabel).toBe('New York, NY')
    }
  })

  it('rejects an out-of-range latitude', () => {
    const result = locationSchema.safeParse({
      latitude: 91,
      longitude: -74.006,
      cityLabel: 'New York, NY',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an out-of-range longitude', () => {
    const result = locationSchema.safeParse({
      latitude: 40.7128,
      longitude: 181,
      cityLabel: 'New York, NY',
    })
    expect(result.success).toBe(false)
  })

  it('rejects NaN coordinates', () => {
    const result = locationSchema.safeParse({
      latitude: Number.NaN,
      longitude: -74.006,
      cityLabel: 'New York, NY',
    })
    expect(result.success).toBe(false)
  })

  it('rejects Infinity coordinates', () => {
    const result = locationSchema.safeParse({
      latitude: 40.7128,
      longitude: Number.POSITIVE_INFINITY,
      cityLabel: 'New York, NY',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty cityLabel', () => {
    const result = locationSchema.safeParse({
      latitude: 40.7128,
      longitude: -74.006,
      cityLabel: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a whitespace-only cityLabel (trim runs before min length check)', () => {
    const result = locationSchema.safeParse({
      latitude: 40.7128,
      longitude: -74.006,
      cityLabel: '   ',
    })
    expect(result.success).toBe(false)
  })

  it('accepts boundary latitude values of 90 and -90', () => {
    const north = locationSchema.safeParse({
      latitude: 90,
      longitude: 0,
      cityLabel: 'North Pole',
    })
    const south = locationSchema.safeParse({
      latitude: -90,
      longitude: 0,
      cityLabel: 'South Pole',
    })
    expect(north.success).toBe(true)
    expect(south.success).toBe(true)
  })

  it('accepts boundary longitude values of 180 and -180', () => {
    const east = locationSchema.safeParse({
      latitude: 0,
      longitude: 180,
      cityLabel: 'Date Line East',
    })
    const west = locationSchema.safeParse({
      latitude: 0,
      longitude: -180,
      cityLabel: 'Date Line West',
    })
    expect(east.success).toBe(true)
    expect(west.success).toBe(true)
  })

  it('accepts a cityLabel of exactly 120 characters and rejects 121', () => {
    const exactly120 = 'a'.repeat(120)
    const exactly121 = 'a'.repeat(121)

    const okResult = locationSchema.safeParse({
      latitude: 0,
      longitude: 0,
      cityLabel: exactly120,
    })
    const tooLongResult = locationSchema.safeParse({
      latitude: 0,
      longitude: 0,
      cityLabel: exactly121,
    })

    expect(okResult.success).toBe(true)
    expect(tooLongResult.success).toBe(false)
  })
})
