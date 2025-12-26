'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { updateMatchQuestionSetsAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { cn } from '@/utils/cn'

type QuestionSetOption = {
  id: string
  name: string
  item_count: number
  original_filename: string | null
  created_at: string
}

type Props = {
  matchId: string
  questionSets: QuestionSetOption[]
  selectedIds: string[]
}

const initialState: ActionState = { error: null, success: null }

export function MatchQuestionSetSelector({ matchId, questionSets, selectedIds }: Props) {
  const [state, formAction] = useActionState(updateMatchQuestionSetsAction, initialState)
  const hasMessage = state.error || state.success

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="matchId" value={matchId} />

      <div className="space-y-2">
        {questionSets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có bộ đề nào. Tải bộ đề ở trang Kho câu hỏi trước.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {questionSets.map((set) => {
              const checked = selectedIds.includes(set.id)
              return (
                <label
                  key={set.id}
                  className="flex items-start gap-3 rounded-md border border-slate-200 px-3 py-2 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                >
                  <input
                    type="checkbox"
                    name="questionSetIds"
                    value={set.id}
                    defaultChecked={checked}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-900">{set.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {set.item_count} câu hỏi · {set.original_filename ?? 'File gốc không rõ'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Tạo lúc {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(set.created_at))}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {hasMessage ? (
        <p className={cn('text-sm', state.error ? 'text-destructive' : 'text-green-600')}>
          {state.error ?? state.success}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={questionSets.length === 0}>
          Lưu gán bộ đề
        </Button>
      </div>
    </form>
  )
}
