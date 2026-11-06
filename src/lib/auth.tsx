import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { neonClient } from "./neon"

export interface AuthUser {
  id: string
  email: string | null
  name: string | null
}

export interface AuthSession {
  token: string
  userAgent?: string
  ipAddress?: string
  createdAt?: string
  expiresAt?: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<string | null>
  resetPassword: (token: string, newPassword: string) => Promise<string | null>
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>
  updateUser: (name: string) => Promise<string | null>
  listSessions: () => Promise<AuthSession[]>
  revokeSession: (token: string) => Promise<string | null>
  revokeOtherSessions: () => Promise<string | null>
  deleteAccount: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function extractUser(result: any): AuthUser | null {
  const account = result?.data?.user ?? result?.user ?? result?.data?.session?.user ?? result?.session?.user
  if (!account?.id) return null
  return {
    id: account.id,
    email: account.email ?? null,
    name: account.name ?? account.displayName ?? null,
  }
}

function errorMessage(result: any, fallback: string): string | null {
  const err = result?.error?.message ?? result?.message ?? (typeof result?.error === "string" ? result.error : null)
  return err ?? (result?.data ? null : fallback)
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
        const result: any = await neonClient.auth.getSession()
        if (!active) return
        const account = extractUser(result)
        setUser(account)
      } catch {
        if (active) setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!neonClient) return "Neon is not configured"
    try {
      const result: any = await neonClient.auth.signIn.email({ email, password })
      const account = extractUser(result)
      if (account) setUser(account)
      return errorMessage(result, "Sign in failed")
    } catch (error) {
      return String(error)
    }
  }

  const signUp = async (email: string, password: string) => {
    if (!neonClient) return "Neon is not configured"
    try {
      const result: any = await neonClient.auth.signUp.email({
        email,
        password,
        name: email.split("@")[0],
      } as any)
      const account = extractUser(result)
      if (account) setUser(account)
      return errorMessage(result, "Sign up failed")
    } catch (error) {
      return String(error)
    }
  }

  const signOut = async () => {
    if (!neonClient) return
    try {
      await (neonClient as any).auth.signOut()
    } finally {
      setUser(null)
    }
  }

  const requestPasswordReset = async (email: string) => {
    if (!neonClient) return "Neon is not configured"
    try {
      const result: any = await (neonClient as any).auth.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}${window.location.pathname}#reset-password`,
      })
      return errorMessage(result, "Could not request password reset")
    } catch (error) {
      return String(error)
    }
  }

  const resetPassword = async (token: string, newPassword: string) => {
    if (!neonClient) return "Neon is not configured"
    try {
      const result: any = await (neonClient as any).auth.resetPassword({
        newPassword,
        token,
      })
      return errorMessage(result, "Could not reset password")
    } catch (error) {
      return String(error)
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!neonClient) return "Neon is not configured"
    try {
      const result: any = await (neonClient as any).auth.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })
      return errorMessage(result, "Could not change password")
    } catch (error) {
      return String(error)
    }
  }

  const updateUser = async (name: string) => {
    if (!neonClient) return "Neon is not configured"
    try {
      const result: any = await (neonClient as any).auth.updateUser({ name })
      const account = extractUser(result)
      if (account) setUser((previous) => (previous ? { ...previous, name: account.name } : previous))
      return errorMessage(result, "Could not update profile")
    } catch (error) {
      return String(error)
    }
  }

  const listSessions = async (): Promise<AuthSession[]> => {
    if (!neonClient) return []
    try {
      const result: any = await (neonClient as any).auth.listSessions()
      const sessions: any[] = Array.isArray(result?.data)
        ? result.data
        : Array.isArray(result)
          ? result
          : (result?.data?.sessions ?? [])
      return sessions.map((session) => ({
        token: session?.token ?? session?.id ?? "",
        userAgent: session?.userAgent ?? session?.device ?? undefined,
        ipAddress: session?.ipAddress ?? undefined,
        createdAt: session?.createdAt ?? session?.created_at ?? undefined,
        expiresAt: session?.expiresAt ?? session?.expires_at ?? undefined,
      }))
    } catch {
      return []
    }
  }

  const revokeSession = async (token: string) => {
    if (!neonClient) return "Neon is not configured"
    try {
      const result: any = await (neonClient as any).auth.revokeSession({ token })
      return errorMessage(result, "Could not revoke session")
    } catch (error) {
      return String(error)
    }
  }

  const revokeOtherSessions = async () => {
    if (!neonClient) return "Neon is not configured"
    try {
      const result: any = await (neonClient as any).auth.revokeSessions()
      return errorMessage(result, "Could not revoke sessions")
    } catch (error) {
      return String(error)
    }
  }

  const deleteAccount = async () => {
    if (!neonClient) return "Neon is not configured"
    try {
      const result: any = await (neonClient as any).auth.deleteUser()
      await signOut()
      return errorMessage(result, "Could not delete account")
    } catch (error) {
      return String(error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        requestPasswordReset,
        resetPassword,
        changePassword,
        updateUser,
        listSessions,
        revokeSession,
        revokeOtherSessions,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used inside AuthProvider")
  return value
}
