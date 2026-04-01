export type NavId = 'general' | 'ai' | 'voice' | 'speakers' | 'permissions' | 'plugins' | 'about'

export const ALL_NAV_IDS: NavId[] = [
  'general',
  'ai',
  'voice',
  'speakers',
  'permissions',
  'plugins',
  'about',
]

export const SECTION_TOP_GUTTER = 30

export function resolveActiveNav(
  sectionTops: Partial<Record<NavId, number>>,
  scrollTop: number,
  offset: number = SECTION_TOP_GUTTER,
): NavId {
  let activeNav: NavId = 'general'

  for (const id of ALL_NAV_IDS) {
    const sectionTop = sectionTops[id]
    if (typeof sectionTop === 'number' && sectionTop <= scrollTop + offset) {
      activeNav = id
    }
  }

  return activeNav
}
