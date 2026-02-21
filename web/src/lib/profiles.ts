
export type AuthType = 'password' | 'key'

export interface Profile {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: AuthType
  shell?: 'bash' | 'wsl'
  projectPath?: string
}

// Helper to manage profiles in localStorage
const STORAGE_KEY = 'cc-mobile-profiles'

export function loadProfiles(): Profile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Profile[]
  } catch (e) {
    console.error('Failed to load profiles', e)
    return []
  }
}

export function saveProfiles(profiles: Profile[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
  } catch (e) {
    console.error('Failed to save profiles', e)
  }
}

export function addProfile(profile: Omit<Profile, 'id'>): Profile {
  const newProfile = { ...profile, id: crypto.randomUUID() }
  const profiles = loadProfiles()
  profiles.push(newProfile)
  saveProfiles(profiles)
  return newProfile
}

export function updateProfile(id: string, updates: Partial<Profile>) {
  const profiles = loadProfiles()
  const index = profiles.findIndex(p => p.id === id)
  if (index !== -1) {
    profiles[index] = { ...profiles[index], ...updates }
    saveProfiles(profiles)
  }
}

export function deleteProfile(id: string) {
  const profiles = loadProfiles()
  const newProfiles = profiles.filter(p => p.id !== id)
  saveProfiles(newProfiles)
  // Also clear credentials
  sessionStorage.removeItem(`cc-mobile-creds-${id}`)
}

// Helper to manage credentials in sessionStorage (cleared on tab close)
export function saveCredentials(id: string, password?: string, privateKey?: string) {
  if (!password && !privateKey) return
  const data = JSON.stringify({ password, privateKey })
  sessionStorage.setItem(`cc-mobile-creds-${id}`, data)
}

export function getCredentials(id: string): { password?: string, privateKey?: string } | null {
  const raw = sessionStorage.getItem(`cc-mobile-creds-${id}`)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
