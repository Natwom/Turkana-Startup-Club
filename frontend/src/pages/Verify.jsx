import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../services/api'

export default function Verify() {
  const { code: urlCode = '' } = useParams()
  const navigate = useNavigate()
  const [code, setCode] = useState(urlCode)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const check = async (value) => {
    const c = value.trim()
    if (!c) return
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const r = await api.get(`/certificates/verify/${encodeURIComponent(c)}`)
      setResult(r.data)
    } catch (err) {
      setError(err.response?.status === 404
        ? 'No certificate found with that code.'
        : 'Could not verify right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCode(urlCode)
    if (urlCode) check(urlCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode])

  const submit = (e) => {
    e.preventDefault()
    if (code.trim()) navigate(`/verify/${encodeURIComponent(code.trim())}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white border rounded-2xl p-8 w-full max-w-md">
        <Link to="/" className="font-bold text-xl text-emerald-700">TSC</Link>
        <h1 className="text-xl font-bold mt-4">Verify a certificate</h1>
        <p className="text-sm text-gray-500 mt-1">Enter the certificate ID (for example TSC-9F3A21BC).</p>

        <form onSubmit={submit} className="mt-4 flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="TSC-XXXXXXXX"
            className="flex-1 px-3 py-2.5 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <button type="submit" disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? 'Checking…' : 'Verify'}
          </button>
        </form>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}
        {result && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-4 text-sm">
            <p className="font-semibold text-emerald-800">✓ Valid certificate</p>
            <p className="mt-2 text-gray-700"><span className="text-gray-500">Holder:</span> {result.holder}</p>
            <p className="text-gray-700"><span className="text-gray-500">Title:</span> {result.title}</p>
            <p className="text-gray-700 capitalize"><span className="text-gray-500">Type:</span> {result.activity_type}</p>
            <p className="text-gray-700">
              <span className="text-gray-500">Issued:</span> {new Date(result.issued_at).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}