'use client'

import { useMemo, useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Option = {
    id: string
    label: string
}

type Props = {
    value: string
    options: Option[]
    disabled?: boolean
    triggerReset?: boolean
}

export function HostPreviewQuestionSelect({ value, options, disabled, triggerReset }: Props) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const prevTriggerRef = useRef(triggerReset)

    const baseParams = useMemo(() => new URLSearchParams(searchParams?.toString()), [searchParams])

    // Reset preview chỉ khi triggerReset thực sự thay đổi từ false → true
    useEffect(() => {
        if (triggerReset && !prevTriggerRef.current) {
            const params = new URLSearchParams(baseParams)
            params.delete('preview')
            const qs = params.toString()
            router.replace(qs ? `${pathname}?${qs}` : pathname)
        }
        prevTriggerRef.current = triggerReset
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [triggerReset])

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
            ) : (
                <option value="">Chưa có câu hỏi</option>
            )}
            {options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                    {opt.label}
                </option>
            ))}
        </select>
    )
}
