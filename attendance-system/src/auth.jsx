/* auth.jsx — React bindings over the logic layer: the logged-in user lives in
   localStorage (via logic/auth.js) and every db change notifies subscribers. */
import { createContext, useContext, useEffect, useState } from 'react'
import { getDB, subscribe, update, resetToSeed } from './logic/storage.js'
import { verifyUser, saveSession, clearSession, currentUser } from './logic/auth.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => currentUser(getDB()))

  // keep the user fresh if the db is reset under us
  useEffect(() => subscribe(() => setUser(currentUser(getDB()))), [])

  function login(email, password, role) {
    const res = verifyUser(getDB(), { email, password, role })
    if (!res.ok) throw new Error(res.error)
    saveSession(res.user)
    setUser(res.user)
    return res.user
  }

  function logout() {
    clearSession()
    setUser(null)
  }

  function resetDemo() {
    resetToSeed()
  }

  return (
    <AuthCtx.Provider value={{ user, setUser, login, logout, resetDemo, update }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
export const homeFor = (u) => (u ? (u.role === 'teacher' ? '/t' : '/s') : '/')

/* Re-renders the component on every db mutation. */
export function useDB() {
  const [db, setDb] = useState(getDB())
  useEffect(() => subscribe(setDb), [])
  return db
}

export { update }
