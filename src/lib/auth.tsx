import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { neonClient } from "./neon"

export interface AuthUser {
  id: string
  email: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function extractUser(result: any): AuthUser | null {
  const account = result?.data?.user ?? result?.user ?? result?.data?.session?.user ?? result?.session?.user
  if (!account?.id) return null
  return { id: account.id, email: account.email ?? null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!neonClient) {
      setLoading(false)
      return
    }
    let active = true
    ;(async () => {
      try {
        const result = await neonClient.auth.getSession()
        if (!active) return
        const account = extractUser(result)?.id ? extractUser(result)! : null
        setUser(account)
      } catch {
        if (!active) return
        setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    })()

  }, [])

  const signIn = async (email: string, password: string) => {
    if (!neonClient) return "Neon is not configured"
    try {
      const result = await neonClient.auth.signIn.email({ email, password })
      const account = extractUser(result)
      if (account) setUser(account)
      return (result as any)?.error?.message ?? null
    } catch (error) {
      return String(error)
    }
  }

  const signUp = async (email: string, password: string) => {
    if (!neonClient) return "Neon is not configured"
    try {
      const result = await neonClient.auth.signUp.email({ email, password, name: email.split("@")[0] } as any)
      const account = extractUser(result)
      if (account) setUser(account)
      return (result as any)?.error?.message ?? null
    } catch (error) {
      return String(error)
    }
  }

  const signOut = async () => {
    if (!neonClient) return
    try {
      await neonClient.auth.signOut()
    } finally {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used inside AuthProvider")
  return value
}