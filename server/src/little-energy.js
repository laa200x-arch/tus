import { readFileSync } from 'node:fs'

const catalogUrl = new URL('../../shared/little-energy/catalog.json', import.meta.url)
const catalog = JSON.parse(readFileSync(catalogUrl, 'utf8'))

export const MOODS = catalog.moods
export const OUTFIT_CATALOG = catalog.outfits
export const DEFAULT_OUTFIT = catalog.defaultOutfit

const moodIds = new Set(MOODS.map((mood) => mood.id))
const moodScores = new Map(MOODS.map((mood) => [mood.id, mood.score]))
const legacyMoodIds = new Map(
  MOODS
    .filter((mood) => typeof mood.legacyEmoji === 'string')
    .map((mood) => [mood.legacyEmoji, mood.id])
)
const topIds = new Set(OUTFIT_CATALOG.tops)
const bottomIds = new Set(OUTFIT_CATALOG.bottoms)
const shoeIds = new Set(OUTFIT_CATALOG.shoes)
const accessoryIds = new Set(OUTFIT_CATALOG.accessories)

function allowedOrDefault(value, allowed, fallback) {
  return typeof value === 'string' && allowed.has(value) ? value : fallback
}

export function normalizeMood(value) {
  if (typeof value !== 'string') return MOODS[0].id
  return moodIds.has(value) ? value : (legacyMoodIds.get(value) || MOODS[0].id)
}

export function moodScore(value) {
  return moodScores.get(normalizeMood(value)) ?? 0
}

export function normalizeOutfit(value) {
  const outfit = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const rawAccessories = Array.isArray(outfit.accessoryIds) ? outfit.accessoryIds : []

  return {
    topId: allowedOrDefault(outfit.topId, topIds, DEFAULT_OUTFIT.topId),
    bottomId: allowedOrDefault(outfit.bottomId, bottomIds, DEFAULT_OUTFIT.bottomId),
    shoesId: allowedOrDefault(outfit.shoesId, shoeIds, DEFAULT_OUTFIT.shoesId),
    accessoryIds: [...new Set(rawAccessories.filter((id) => typeof id === 'string' && accessoryIds.has(id)))]
  }
}

export function isLittleEnergyEmoji(value) {
  return typeof value === 'string' && moodIds.has(value)
}
