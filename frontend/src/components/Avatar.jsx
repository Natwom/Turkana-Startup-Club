import { useEffect, useState } from 'react'

export default function Avatar({ name = '', url = '', size = 'w-8 h-8', text = 'text-sm' }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [url])

  if (url && !broken) {
    return (
      <img src={url} alt={name} onError={() => setBroken(true)}
        className={`${size} rounded-full object-cover bg-gray-100`} />
    )
  }
  return (
    <div className={`${size} ${text} rounded-full bg-emerald-100 text-emerald-700 font-bold
      flex items-center justify-center shrink-0`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}