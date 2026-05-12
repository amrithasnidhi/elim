import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT from zustand store on every request
api.interceptors.request.use((config) => {
  // Dynamic import to avoid circular dep — read raw from localStorage
  try {
    const stored = JSON.parse(localStorage.getItem('elim-auth') || '{}')
    const token = stored?.state?.accessToken
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch {
    // ignore
  }
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const stored = JSON.parse(localStorage.getItem('elim-auth') || '{}')
        const refreshToken = stored?.state?.refreshToken
        if (!refreshToken) throw new Error('no refresh token')

        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/auth/refresh`,
          { refresh_token: refreshToken }
        )

        // Update store with new access token
        const parsed = JSON.parse(localStorage.getItem('elim-auth') || '{}')
        parsed.state.accessToken = data.access_token
        localStorage.setItem('elim-auth', JSON.stringify(parsed))

        original.headers.Authorization = `Bearer ${data.access_token}`
        return api(original)
      } catch {
        // Clear auth on refresh failure
        localStorage.removeItem('elim-auth')
        window.location.href = '/auth/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
