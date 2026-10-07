import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tsc_admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401 (expired/invalid token), clear session and bounce to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginPage = window.location.pathname.includes('/admin/login')
    if (error.response?.status === 401 && !isLoginPage) {
      localStorage.removeItem('tsc_admin_token')
      window.location.href = '/admin/login'
    }
    return Promise.reject(error)
  }
)

// Helper: pull a readable message out of a FastAPI error
export const errorMessage = (err, fallback = 'Something went wrong') => {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(', ')
  return fallback
}

export default api