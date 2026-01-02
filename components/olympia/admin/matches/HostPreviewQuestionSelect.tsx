'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Option = {
  id: string
  label: string
}

type Props = {
  value: string
  options: Option[]
  disabled?: boolean
}

export function HostPreviewQuestionSelect({ value, options, disabled }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const baseParams = useMemo(() => new URLSearchParams(searchParams?.toString()), [searchParams])

  return (
    <select
      value={value}
      onChange={(e) => {
        const next = e.target.value
        const params = new URLSearchParams(baseParams)
        if (next) params.set('preview', next)
        else params.delete('preview')
        const qs = params.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname)
      }}
      className="w-[220px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
      disabled={disabled}
      aria-label="Danh sách câu hỏi"
    >
      {options.length === 0 ? (
        <option value="" disabled>
          Chưa có câu trong vòng
        </option>
      ) : null}
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
