import { useMemo, useState } from 'react'
import { initials } from './chatUtils'

export default function MemberPicker({
  options,
  selected,
  onToggle,
  emptyText = 'No connections available.',
}) {
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return options
    return options.filter((o) => (o.full_name || '').toLowerCase().includes(needle))
  }, [options, q])

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {options.length > 5 && (
        <div className="p-2 border-b border-gray-100">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search connections…"
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      )}
      <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
        {list.length === 0 ? (
          <p className="p-4 text-sm text-gray-500 text-center">
            {q ? 'No matches.' : emptyText}
          </p>
        ) : (
          list.map((o) => (
            <label
              key={o.user_id}
              className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(o.user_id)}
                onChange={() => onToggle(o.user_id)}
                className="accent-emerald-600"
              />
              <span className="w-8 h-8 shrink-0 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                {initials(o.full_name)}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-800 truncate">{o.full_name}</span>
                {o.role && <span className="block text-xs text-gray-500 truncate">{o.role}</span>}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}