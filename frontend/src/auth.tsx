import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, TOKEN_KEY } from './api'
import type { User } from './types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  demoLogin: () => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)))

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    let cancelled = false
    api
      .me()
      .then((current) => {
        if (!cancelled) setUser(current)
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password)
    localStorage.setItem(TOKEN_KEY, response.access_token)
    setUser(response.user)
  }, [])

  const demoLogin = useCallback(async () => {
    const response = await api.demoLogin()
    localStorage.setItem(TOKEN_KEY, response.access_token)
    setUser(response.user)
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const response = await api.register(email, password)
    localStorage.setItem(TOKEN_KEY, response.access_token)
    setUser(response.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, demoLogin, register, logout }),
    [user, loading, login, demoLogin, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
