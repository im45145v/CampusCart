import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, api, tokenStore } from './api'
import type { User } from './types'

export interface EmailStartResult {
  sent?: boolean
  needs_name?: boolean
  dev_code?: string
}

interface AuthState {
  user: User | null
  loading: boolean
  requestEmailCode: (email: string, name?: string) => Promise<EmailStartResult>
  verifyEmailCode: (email: string, code: string) => Promise<void>
  verifyMagicLink: (token: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function loadMe(): Promise<User> {
  let last: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await api<User>('/api/auth/me')
    } catch (e) {
      last = e
      if (e instanceof ApiError && e.status === 401) throw e
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
  throw last
}

function adopt(setUser: (user: User) => void, result: { token: string; user: User }) {
  tokenStore.set(result.token)
  setUser(result.user)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!tokenStore.get())

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      setUser(await loadMe())
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        tokenStore.clear()
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      refresh,
      requestEmailCode: (email, name) =>
        api<EmailStartResult>('/api/auth/email/start', {
          method: 'POST',
          body: { email, ...(name ? { name } : {}) },
        }),
      verifyEmailCode: async (email, code) => {
        adopt(setUser, await api('/api/auth/email/verify', { method: 'POST', body: { email, code } }))
      },
      verifyMagicLink: async (token) => {
        adopt(setUser, await api('/api/auth/email/verify-link', { method: 'POST', body: { token } }))
      },
      register: async (name, email, password) => {
        adopt(setUser, await api('/api/auth/register', { method: 'POST', body: { name, email, password } }))
      },
      login: async (email, password) => {
        adopt(setUser, await api('/api/auth/login', { method: 'POST', body: { email, password } }))
      },
      logout: () => {
        tokenStore.clear()
        setUser(null)
      },
    }),
    [user, loading, refresh],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
