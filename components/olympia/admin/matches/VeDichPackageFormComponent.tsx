'use client'

import React, { useActionState, useState, useEffect } from 'react'
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
    const [formValues, setFormValues] = useState<string[]>(
        values.map((v) => (v === 20 || v === 30 ? String(v) : ''))
    )

    const [state, formAction, isPending] = useActionState(selectVeDichPackageClientAction, initialState)

    const handleSelectChange = (index: number, value: string) => {
        const newValues = [...formValues]
        newValues[index] = value
        setFormValues(newValues)
    }

    // Build form on submission to include dynamic form values
    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        const formData = new FormData(e.currentTarget)
        formData.set('matchId', matchId)
        formData.set('playerId', selectedPlayer.id)
        // Replace form values with current state
        formData.delete('values')
        for (const v of formValues) {
            formData.append('values', v)
        }
        // Dispatch the form action
        formAction(formData)
    }

    // Show toast when state changes
    useEffect(() => {
        if (state?.error) {
            toast.error(state.error)
        } else if (state?.success) {
            toast.success(state.success)
        }
    }, [state?.error, state?.success])

    const seatIndex = selectedPlayer.seat_index ?? 'N/A'

    return (
        <div className="mt-3 rounded-md border bg-background p-2">
            <p className="text-xs font-medium truncate">
                Ghế {seatIndex} · {selectedPlayer.display_name ?? 'Thí sinh'}
            </p>
            <p className="text-[11px] text-muted-foreground">
                {confirmed ? 'Đã chốt gói' : 'Chưa chốt gói'}
            </p>
            <form onSubmit={handleFormSubmit} className="mt-2 grid gap-2">
                <div className="grid grid-cols-3 gap-2">
                    {formValues.map((v, idx) => (
                        <select
                            key={idx}
                            value={v}
                            onChange={(e) => handleSelectChange(idx, e.target.value)}
                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                            disabled={confirmed || isPending}
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
                        disabled={confirmed || isPending}
                        aria-label="Xác nhận gói Về đích"
                        title="Xác nhận gói Về đích"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Đang xác nhận
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
