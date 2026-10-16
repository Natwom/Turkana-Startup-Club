import { useEffect, useState } from 'react'
import api from '../services/api'
import MemberPicker from './MemberPicker'
import { errorMessage } from './chatUtils'

export default function NewGroupModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [connections, setConnections] = useState([])
  const [selected, setSelected] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/members/connections')
      .then((r) => setConnections(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
  }, [])

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      const r = await api.post('/groups', {
        name: name.trim(),
        description: description.trim(),
        member_ids: selected,
      })
      onCreated(r.data)
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">New group</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Group name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoFocus
            placeholder="e.g. Lodwar Devs"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            placeholder="What is this group about?"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Add members <span className="text-gray-400 font-normal">({selected.length} selected)</span>
          </label>
          <MemberPicker
            options={connections}
            selected={selected}
            onToggle={toggle}
            emptyText="You have no connections yet. Connect with members in the Directory first."
          />
        </div>

        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={!name.trim() || saving}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">
            {saving ? 'Creating…' : 'Create group'}
          </button>
        </div>
      </form>
    </div>
  )
}