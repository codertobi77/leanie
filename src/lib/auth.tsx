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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!neonClient) {
      setLoading(false)
      return
    }
    let active = true
    neonClient.auth.getSession().then(({ data }) => {
      if (!active) return
      const sessionUser = data.session?.user
      setUser(
        sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? null } : null,
      )
      setLoading(false)
    })
    const { data: subscription } = neonClient.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user
      setUser(
        sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? null } : null,
      )
    })
    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!neonClient) return "Neon is not configured"
    const { data, error } = await neonClient.auth.signInWithPassword({ email, password })
    const sessionUser = (data as any)?.session?.user ?? (data as any)?.user
    if (sessionUser?.id) setUser({ id: sessionUser.id, email: sessionUser.email ?? email })
    return error?.message ?? null
  }

  const signUp = async (email: string, password: string) => {
    if (!neonClient) return "Neon is not configured"
    const { error: signUpError } = await neonClient.auth.signUp({ email, password }) as any
    if (signUpError?.message) return signUpError.message
    const { data: sessionData, error: signInError } = await neonClient.auth.signInWithPassword({ email, password })
    if (signInError?.message) return signInError.message
    const sessionUser = (sessionData as any)?.session?.user ?? (sessionData as any)?.user
    if (sessionUser?.id) setUser({ id: sessionUser.id, email: sessionUser.email ?? email })
    return null
  }

  const signOut = async () => {
    if (!neonClient) return
    await neonClient.auth.signOut()
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
