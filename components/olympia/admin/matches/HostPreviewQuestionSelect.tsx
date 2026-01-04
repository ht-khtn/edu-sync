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
    const prefetchedKeyRef = useRef<string | null>(null)

    const baseParams = useMemo(() => new URLSearchParams(searchParams?.toString()), [searchParams])

    // Prefetch các route preview để chuyển câu gần như tức thì.
    useEffect(() => {
        if (!pathname) return
        if (!options || options.length === 0) return

        const key = `${pathname}|${baseParams.toString()}|${options.map((o) => o.id).join(',')}`
        if (prefetchedKeyRef.current === key) return
        prefetchedKeyRef.current = key

        const urls = options
            .map((opt) => {
                const params = new URLSearchParams(baseParams)
                params.set('preview', opt.id)
                const qs = params.toString()
                return qs ? `${pathname}?${qs}` : pathname
            })
            .slice(0, 30)

        type IdleCallbackDeadline = { didTimeout: boolean; timeRemaining: () => number }
        type RequestIdleCallback = (cb: (deadline: IdleCallbackDeadline) => void, opts?: { timeout: number }) => number
        type CancelIdleCallback = (handle: number) => void

        const w = window as unknown as {
            requestIdleCallback?: RequestIdleCallback
            cancelIdleCallback?: CancelIdleCallback
        }

        const run = () => {
            urls.forEach((url) => router.prefetch(url))
        }

        if (typeof w.requestIdleCallback === 'function') {
            const handle = w.requestIdleCallback(() => run(), { timeout: 800 })
            return () => {
                if (typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(handle)
            }
        }

        const t = setTimeout(() => run(), 0)
        return () => clearTimeout(t)
    }, [pathname, router, options, baseParams])

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
