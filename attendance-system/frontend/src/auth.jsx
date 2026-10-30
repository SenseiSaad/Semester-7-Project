import { createContext, useContext, useEffect, useState } from 'react'
import { api, getDeviceToken } from './api'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!localStorage.getItem('saes_access')) { setLoading(false); return }
    api.get('/auth/me/')
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem('saes_access')
        localStorage.removeItem('saes_refresh')
      })
      .finally(() => setLoading(false))
  }, [])

  // a student's first login registers this browser as their one device
  async function ensureDevice(u) {
    if (u.role !== 'student' || u.device_registered) return u
    await api.post('/devices/register/', { device_token: getDeviceToken() })
    return { ...u, device_registered: true }
  }

  async function login(email, password) {
    const { data } = await api.post('/auth/token/', { email, password })
    localStorage.setItem('saes_access', data.access)
    localStorage.setItem('saes_refresh', data.refresh)
    const me = await api.get('/auth/me/')
    const u = await ensureDevice(me.data)
    setUser(u)
    return u
  }

  async function logout() {
    localStorage.removeItem('saes_access')
    localStorage.removeItem('saes_refresh')
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, login, logout, ensureDevice }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
export const homeFor = (u) => (u ? (u.role === 'teacher' ? '/t' : '/s') : '/')
