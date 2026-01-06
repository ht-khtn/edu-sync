'use client'

import { useMemo, useState } from 'react'
buildPath: (joinCode) => `/olympia/client/admin/${joinCode}`,
import { Input } from '@/components/ui/input'
import { Check, Copy } from 'lucide-react'

type LinkKind = 'player' | 'mc' | 'guest'

type Props = {
    joinCode: string | null
}

type LinkRow = {
    kind: LinkKind
    label: string
    buildPath: (joinCode: string) => string
}

const rows: LinkRow[] = [
    {
        kind: 'player',
        label: 'Link thí sinh',
        buildPath: (joinCode) => `/olympia/client/game/${joinCode}`,
    },
    {
        kind: 'mc',
        label: 'Link MC',
        buildPath: (joinCode) => `/olympia/mc/${joinCode}`,
    },
    {
        kind: 'guest',
        label: 'Link Guest',
        buildPath: (joinCode) => `/olympia/client/guest/${joinCode}`,
    },
]

export function CopyRoomLinksPanel({ joinCode }: Props) {
    const [origin] = useState<string>(() => (typeof window !== 'undefined' ? window.location.origin : ''))
    const [copiedKind, setCopiedKind] = useState<LinkKind | null>(null)

    const links = useMemo(() => {
        if (!joinCode) return []
        const trimmed = joinCode.trim()
        if (!trimmed) return []

        return rows.map((row) => {
            const path = row.buildPath(trimmed)
            const full = origin ? `${origin}${path}` : path
            return { ...row, full }
        })
    }, [joinCode, origin])

    async function handleCopy(kind: LinkKind, value: string) {
        try {
            await navigator.clipboard.writeText(value)
            setCopiedKind(kind)
            window.setTimeout(() => setCopiedKind(null), 1500)
        } catch {
            const textarea = document.createElement('textarea')
            textarea.value = value
            document.body.appendChild(textarea)
            textarea.select()
            document.execCommand('copy')
            document.body.removeChild(textarea)
            setCopiedKind(kind)
            window.setTimeout(() => setCopiedKind(null), 1500)
        }
    }

    if (!joinCode || links.length === 0) {
        return (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                Chưa có phòng live (join code). Hãy mở phòng trước để lấy link.
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {links.map((row) => (
                <div key={row.kind} className="flex flex-col gap-1">
                    <p className="text-xs font-medium text-slate-700">{row.label}</p>
                    <div className="flex items-center gap-2">
                        <Input readOnly value={row.full} className="font-mono text-xs" />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleCopy(row.kind, row.full)}
                            aria-label={`Sao chép ${row.label}`}
                            title={`Sao chép ${row.label}`}
                            className="shrink-0"
                        >
                            {copiedKind === row.kind ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    )
}
