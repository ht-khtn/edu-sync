'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function McJoinForm() {
    const router = useRouter()
    const [joinCode, setJoinCode] = useState('')

    return (
        <form
            className="space-y-3"
            onSubmit={(e) => {
                e.preventDefault()
                const code = joinCode.trim().toUpperCase()
                if (!code) return
                router.push(`/olympia/client/mc/${code}`)
            }}
        >
            <div>
                <label htmlFor="mcJoinCode" className="block text-sm font-medium mb-2">
                    Mã phòng (join code)
                </label>
                <Input
                    id="mcJoinCode"
                    placeholder="Ví dụ: ABC123"
                    className="font-mono text-lg tracking-widest"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    autoComplete="off"
                />
            </div>
            <Button type="submit" className="w-full" disabled={!joinCode.trim()}>
                Vào màn hình MC
            </Button>
        </form>
    )
}
