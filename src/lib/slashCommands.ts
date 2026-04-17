import { listSkills, type SkillInfo } from './tauri'

export interface SkillItem {
  name: string
  description: string
  scope: string
}

let cachedSkills: SkillItem[] | null = null
let cacheTime = 0
const CACHE_TTL = 30_000 // 30s

export async function fetchSkills(): Promise<SkillItem[]> {
  const now = Date.now()
  if (cachedSkills && now - cacheTime < CACHE_TTL) {
    return cachedSkills
  }
  try {
    const skills: SkillInfo[] = await listSkills()
    cachedSkills = skills.map((s) => ({
      name: s.dir_name,
      description: s.description,
      scope: s.scope,
    }))
    cacheTime = now
    return cachedSkills
  } catch {
    return cachedSkills ?? []
  }
}

export function filterSkills(skills: SkillItem[], query: string): SkillItem[] {
  if (!query) return skills
  const q = query.toLowerCase()
  return skills.filter(
    (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
  )
}

export function invalidateSkillCache(): void {
  cachedSkills = null
  cacheTime = 0
}
