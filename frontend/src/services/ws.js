// Builds the WebSocket address from the same setting api.js uses.
// Development: '/api' (Vite proxy)  ->  ws://localhost:5173/api/ws
// Production:  VITE_API_URL=https://your-backend.onrender.com/api  ->  wss://your-backend.onrender.com/api/ws
const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export const realtimeUrl = () => {
  if (/^https?:\/\//i.test(API_URL)) return `${API_URL.replace(/^http/i, 'ws')}/ws`
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}${API_URL}/ws`
}