'use client'

import React, { useActionState, useState, useEffect, useMemo, useCallback } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { selectVeDichPackageClientAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { Undo2 } from 'lucide-react'

const initialState: ActionState = { error: null, success: null }

interface VeDichPackageFormComponentProps {
    matchId: string
    selectedPlayer: {
        id: string
        seat_index: number | null
        display_name: string | null
    }
    values: Array<20 | 30 | null>
    confirmed: boolean
}

export function VeDichPackageFormComponent({
    matchId,
    selectedPlayer,
    values,
    confirmed,
}: VeDichPackageFormComponentProps) {
    const [localFormValues, setLocalFormValues] = useState<string[]>(() =>
        values.map((v) => (v === 20 || v === 30 ? String(v) : ''))
    )
    const [state, formAction, isPending] = useActionState(selectVeDichPackageClientAction, initialState)
    const [isResetting, setIsResetting] = useState(false)

    // Sync formValues when selectedPlayer changes or values/confirmed changes
    useEffect(() => {
        queueMicrotask(() => {
            setLocalFormValues(values.map((v) => (v === 20 || v === 30 ? String(v) : '')))
        })
    }, [selectedPlayer.id, values, confirmed])

    const handleSelectChange = useCallback((index: number, value: string) => {
        setLocalFormValues((prev) => {
            const newValues = [...prev]
            newValues[index] = value
            return newValues
        })
    }, [])

    // Show toast when state changes
    useEffect(() => {
        if (state?.error) {
            toast.error(state.error)
        } else if (state?.success) {
            toast.success(state.success)
        }
    }, [state?.error, state?.success])

    const canSubmit = useMemo(() => {
        if (!confirmed && isPending) return false
        return localFormValues.every((v) => v === '20' || v === '30')
    }, [localFormValues, isPending, confirmed])

    const seatIndex = selectedPlayer.seat_index ?? 'N/A'

    const handleResetClick = useCallback(async () => {
        setIsResetting(true)
        try {
            const formData = new FormData()
            formData.append('matchId', matchId)
            const result = await fetch('/api/olympia/reset-ve-dich-packages', {
                method: 'POST',
                body: formData,
            })
            const data = await result.json()
            if (data?.error) {
                toast.error(data.error)
            } else if (data?.success) {
                toast.success(data.success)
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Lỗi khi reset gói')
        } finally {
            setIsResetting(false)
        }
    }, [matchId])

    return (
        <div className="mt-3 rounded-md border bg-background p-2">
            <p className="text-xs font-medium truncate">
                Ghế {seatIndex} · {selectedPlayer.display_name ?? 'Thí sinh'}
            </p>
            <p className="text-[11px] text-muted-foreground">
                {confirmed ? 'Đã chốt gói' : 'Chưa chốt gói'}
            </p>
            <form action={formAction} className="mt-2 grid gap-2">
                <input type="hidden" name="matchId" value={matchId} />
                <input type="hidden" name="playerId" value={selectedPlayer.id} />
                <div className="grid grid-cols-3 gap-2">
                    {localFormValues.map((v, idx) => (
                        <select
                            key={idx}
                            name="values"
                            value={v}
                            onChange={(e) => handleSelectChange(idx, e.target.value)}
                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                            disabled={confirmed || isPending}
                            required
                            aria-label={`Giá trị câu ${idx + 1}`}
                        >
                            {!v ? <option value="">— Chọn —</option> : null}
                            <option value="20">20</option>
                            <option value="30">30</option>
                        </select>
                    ))}
                </div>

                <div className="flex justify-end gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        title="Reset gói cho tất cả thí sinh"
                        aria-label="Reset gói cho tất cả thí sinh"
                        disabled={isPending || isResetting}
                        onClick={handleResetClick}
                    >
                        {isResetting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Reset...
                            </>
                        ) : (
                            <>
                                <Undo2 className="h-4 w-4 mr-1" />
                                Reset gói
                            </>
                        )}
                    </Button>
                    <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={!canSubmit || isResetting || confirmed}
                        aria-label={confirmed ? 'Đã chốt gói' : 'Xác nhận gói Về đích'}
                        title={confirmed ? 'Đã chốt gói' : 'Xác nhận gói Về đích'}
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Đang chọn gói
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4 mr-1" />
                                {confirmed ? 'Đã chốt gói' : 'Xác nhận gói'}
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    )
}
