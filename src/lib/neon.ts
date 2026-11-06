import { createClient, SupabaseAuthAdapter } from "@neondatabase/neon-js"

const authUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL as string | undefined

export const hasNeon = Boolean(authUrl && dataApiUrl)

export const neonClient = hasNeon
  ? createClient({
      auth: { url: authUrl! },
      dataApi: { url: dataApiUrl! },
    })
  : null

export const hasNeonAuth = hasNeon
export const hasNeonDataApi = hasNeon
export const hasNeonStorage = true
export const hasNeonFunctions = true
export const hasNeonRealtime = true

export function requireNeon(): NonNullable<typeof neonClient> {
  if (!neonClient) throw new Error("Neon is not configured")
  return neonClient
}
