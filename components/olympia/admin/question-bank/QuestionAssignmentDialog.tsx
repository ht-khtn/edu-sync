'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'

type Question = {
  id: string
  content: string
  difficulty?: string
}

type Round = {
  id: string
  roundType: string
  orderIndex: number
  label: string
}

type AssignedQuestion = {
  roundId: string
  questionId: string
}

type Props = {
  rounds: Round[]
  questions: Question[]
  existingAssignments?: AssignedQuestion[]
  onSave?: (assignments: AssignedQuestion[]) => Promise<void>
}

const difficultyColor: Record<string, string> = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-red-100 text-red-700',
  veryhard: 'bg-purple-100 text-purple-700',
}

export function QuestionAssignmentDialog({ rounds, questions, existingAssignments = [], onSave }: Props) {
  const [open, setOpen] = useState(false)
  const [assignments, setAssignments] = useState<AssignedQuestion[]>(existingAssignments)
  const [isLoading, setIsLoading] = useState(false)

  const handleSelectQuestion = (roundId: string, questionId: string) => {
    setAssignments((prev) => {
      const filtered = prev.filter((a) => !(a.roundId === roundId && a.questionId === questionId))
      if (filtered.length === prev.length) {
        return [...prev, { roundId, questionId }]
      }
      return filtered
    })
  }

  const handleSave = async () => {
    if (!onSave) return
    setIsLoading(true)
    try {
      await onSave(assignments)
      setOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  const getAssignedQuestion = (roundId: string) => {
    const assignment = assignments.find((a) => a.roundId === roundId)
    return assignment ? questions.find((q) => q.id === assignment.questionId) : null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Gán câu hỏi cho vòng
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gán câu hỏi cho các vòng thi</DialogTitle>
          <DialogDescription>Chọn một câu hỏi cho mỗi vòng. Bạn có thể thay đổi câu hỏi bất kỳ lúc nào.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4">
          {rounds.map((round) => {
            const assigned = getAssignedQuestion(round.id)
            return (
              <div key={round.id} className="space-y-2">
                <Label className="text-base font-semibold">{round.label}</Label>
                <div className="space-y-2">
                  {assigned && (
                    <Card className="border-green-200 bg-green-50 p-3">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="mt-1">
                          Đã chọn
                        </Badge>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{assigned.content}</p>
                          {assigned.difficulty && (
                            <Badge variant="outline" className={cn('mt-1 text-xs', difficultyColor[assigned.difficulty])}>
                              {assigned.difficulty}
                            </Badge>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSelectQuestion(round.id, assigned.id)}
                          className="h-6 px-2 text-xs"
                        >
                          Bỏ chọn
                        </Button>
                      </div>
                    </Card>
                  )}
                  <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
                    {questions.map((question) => (
                      <button
                        key={question.id}
                        type="button"
                        onClick={() => handleSelectQuestion(round.id, question.id)}
                        className={cn(
                          'rounded-lg border-2 p-2 text-left text-sm transition-colors',
                          assigned?.id === question.id
                            ? 'border-green-500 bg-green-50'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        )}
                      >
                        <p className="line-clamp-2 font-medium">{question.content}</p>
                        {question.difficulty && (
                          <Badge
                            variant="outline"
                            className={cn('mt-1 text-xs', difficultyColor[question.difficulty])}
                          >
                            {question.difficulty}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading || assignments.length === 0}
            className="flex-1"
          >
            {isLoading ? 'Đang lưu…' : 'Lưu gán câu hỏi'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
