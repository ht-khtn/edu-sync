'use client'

import { useState, useMemo } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

type Props = {
    matchName: string | null
    tournamentName: string | null
    joinCode: string | null
    playerPassword?: string | null
    mcPassword?: string | null
}

export function TournamentInfoCard({
    matchName,
    tournamentName,
    joinCode,
    playerPassword,
    mcPassword,
}: Props) {
    const [showAllLinks, setShowAllLinks] = useState(false)
    const [copiedState, setCopiedState] = useState<boolean>(false)

    const links = useMemo(() => {
        if (!joinCode) return null
        const trimmed = joinCode.trim()
        if (!trimmed) return null

        // Get origin from window only when needed
        const origin = typeof window !== 'undefined' ? window.location.origin : ''
        if (!origin) return null

        const playerLink = `${origin}/olympia/client/game/${trimmed}`
        const mcLink = `${origin}/olympia/client/mc/${trimmed}`
        const guestLink = `${origin}/olympia/client/guest/${trimmed}`

        return { playerLink, mcLink, guestLink }
    }, [joinCode])

    const now = new Date().toLocaleString('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
    })

    const generateContent = (includeAll: boolean): string => {
        const parts: string[] = []

        // Header line
        const header = [matchName, tournamentName, now].filter(Boolean).join(' | ')
        parts.push(header)
        parts.push('----------')

        // Join code
        parts.push(`Mã phòng: ${joinCode || '—'}`)
        parts.push('----------')

        // Player info
        parts.push(`Link thí sinh: ${links?.playerLink || '—'}`)
        if (playerPassword) {
            parts.push(`Mật khẩu thí sinh: ${playerPassword}`)
        }

        if (includeAll) {
            parts.push('----------')
            parts.push(`Link MC: ${links?.mcLink || '—'}`)
            if (mcPassword) {
                parts.push(`Mật khẩu MC: ${mcPassword}`)
            }
            parts.push('----------')
            parts.push(`Link khách: ${links?.guestLink || '—'}`)
        }

        return parts.join('\n')
    }

    const contentToDisplay = generateContent(showAllLinks)

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(contentToDisplay)
            setCopiedState(true)
            toast.success('Đã sao chép nội dung')
            window.setTimeout(() => setCopiedState(false), 1500)
        } catch {
            const textarea = document.createElement('textarea')
            textarea.value = contentToDisplay
            document.body.appendChild(textarea)
            textarea.select()
            document.execCommand('copy')
            document.body.removeChild(textarea)
            setCopiedState(true)
            toast.success('Đã sao chép nội dung')
            window.setTimeout(() => setCopiedState(false), 1500)
        }
    }

    if (!joinCode) {
        return (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                Chưa có phòng live (join code). Hãy mở phòng trước để lấy thông tin.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Toggle switch */}
            <div className="flex items-center gap-3">
                <Switch
                    checked={showAllLinks}
                    onCheckedChange={setShowAllLinks}
                    id="show-all-links"
                />
                <label htmlFor="show-all-links" className="text-sm font-medium cursor-pointer">
                    Toàn bộ
                </label>
            </div>

            {/* Content display */}
            <div className="rounded-md border border-slate-300 bg-slate-50 p-4 font-mono text-sm whitespace-pre-wrap break-words text-slate-900">
                {contentToDisplay}
            </div>

            {/* Copy button */}
            <Button
                type="button"
                variant="outline"
                onClick={handleCopy}
                className="w-full"
            >
                {copiedState ? (
                    <>
                        <Check className="h-4 w-4 mr-2" />
                        Đã sao chép
                    </>
                ) : (
                    <>
                        <Copy className="h-4 w-4 mr-2" />
                        Sao chép nội dung
                    </>
                )}
            </Button>
        </div>
    )
}
