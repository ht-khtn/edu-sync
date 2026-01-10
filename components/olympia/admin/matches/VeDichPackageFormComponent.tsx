'use client'

import React, { useActionState, useState, useEffect, useMemo, useCallback } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { selectVeDichPackageClientAction, type ActionState } from '@/app/(olympia)/olympia/actions'

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

    // Sync formValues when selectedPlayer changes (dependency on selectedPlayer.id)
    useEffect(() => {
        queueMicrotask(() => {
            setLocalFormValues(values.map((v) => (v === 20 || v === 30 ? String(v) : '')))
        })
    }, [selectedPlayer.id, values])

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

    // localConfirmed là giá trị dẫn xuất: từ confirmed prop hoặc action success
    const localConfirmed = useMemo(() => {
        return confirmed || (state?.success ? true : false)
    }, [confirmed, state?.success])

    const canSubmit = useMemo(() => {
        if (localConfirmed) return false
        if (isPending) return false
        return localFormValues.every((v) => v === '20' || v === '30')
    }, [localFormValues, isPending, localConfirmed])

    const seatIndex = selectedPlayer.seat_index ?? 'N/A'

    return (
        <div className="mt-3 rounded-md border bg-background p-2">
            <p className="text-xs font-medium truncate">
                Ghế {seatIndex} · {selectedPlayer.display_name ?? 'Thí sinh'}
            </p>
            <p className="text-[11px] text-muted-foreground">
                {localConfirmed ? 'Đã chốt gói' : 'Chưa chốt gói'}
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
                            disabled={localConfirmed || isPending}
                            required
                            aria-label={`Giá trị câu ${idx + 1}`}
                        >
                            {!v ? <option value="">— Chọn —</option> : null}
                            <option value="20">20</option>
                            <option value="30">30</option>
                        </select>
                    ))}
                </div>

                <div className="flex justify-end">
                    <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={!canSubmit}
                        aria-label={localConfirmed ? 'Đã chốt gói' : 'Xác nhận gói Về đích'}
                        title={localConfirmed ? 'Đã chốt gói' : 'Xác nhận gói Về đích'}
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Đang chọn gói
                            </>
                        ) : localConfirmed ? (
                            <>
                                <Check className="h-4 w-4 mr-1" />
                                Đã chốt gói
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4 mr-1" />
                                Xác nhận gói
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    )
}
