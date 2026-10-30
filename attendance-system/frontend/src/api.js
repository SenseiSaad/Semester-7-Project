import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

export const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('saes_access')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

let refreshing = null
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const { response, config } = err
    if (response?.status === 401 && !config._retried && localStorage.getItem('saes_refresh')) {
      config._retried = true
      try {
        refreshing = refreshing || axios.post(`${API_URL}/auth/token/refresh/`, {
          refresh: localStorage.getItem('saes_refresh'),
        })
        const { data } = await refreshing
        refreshing = null
        localStorage.setItem('saes_access', data.access)
        config.headers.Authorization = `Bearer ${data.access}`
        return api(config)
      } catch {
        refreshing = null
      }
      localStorage.removeItem('saes_access')
      localStorage.removeItem('saes_refresh')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export function errMsg(e) {
  const d = e?.response?.data
  if (!d) return e?.message || 'Network error — is the backend running?'
  if (typeof d === 'string') return d
  if (d.detail) return d.detail
  const first = Object.entries(d)[0]
  return first ? `${first[0]}: ${Array.isArray(first[1]) ? first[1][0] : first[1]}` : 'Request failed'
}

export const DEVICE_KEY = 'saes_device'
export function getDeviceToken() {
  let t = localStorage.getItem(DEVICE_KEY)
  if (!t) {
    t = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, t)
  }
  return t
}
