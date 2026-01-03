'use client'

import { Timer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type Props = {
    enabled?: boolean
    deadlineIso: string | null
    className?: string
}

export function HostAutoAdvancePersonalKhoiDong({ enabled = true, deadlineIso, className }: Props) {
    const deadlineMs = useMemo(() => {
        if (!deadlineIso) return null
        const ms = new Date(deadlineIso).getTime()
        return Number.isFinite(ms) ? ms : null
    }, [deadlineIso])

    const [nowMs, setNowMs] = useState(() => Date.now())

    useEffect(() => {
        if (!enabled) return
        if (!deadlineMs) return

        const t = window.setInterval(() => {
            setNowMs(Date.now())
        }, 250)

        return () => {
            window.clearInterval(t)
        }
    }, [enabled, deadlineMs])

    if (!enabled) return null
    if (!deadlineMs) return null

    const remainingMs = deadlineMs - nowMs
    const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000))
    const text = remainingSec > 0 ? `Còn ${remainingSec}s` : 'Hết giờ'

    return (
        <div className={className} aria-label={text} title={text}>
            <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Timer className="h-3.5 w-3.5" />
                <span>{text}</span>
            </div>
        </div>
    )
}
