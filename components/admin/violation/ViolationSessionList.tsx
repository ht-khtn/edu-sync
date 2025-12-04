"use client"

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import type { Criteria, Student, ViolationRecord } from '@/lib/violations'

type Props = {
  records: ViolationRecord[]
  students: Student[]
  criteria: Criteria[]
  canComplaint: boolean
}

export default function ViolationSessionList({ records, students, criteria, canComplaint }: Props) {
  const [activeComplaint, setActiveComplaint] = useState<string | null>(null)
  const [complaintText, setComplaintText] = useState('')

  function openComplaint(id: string) {
    if (!canComplaint) return
    setActiveComplaint(id === activeComplaint ? null : id)
    setComplaintText('')
  }

  function submitComplaint(id: string) {
    // For now just log; future: post to /api/complaints
    console.log('Complaint draft', { record_id: id, text: complaintText })
    setActiveComplaint(null)
    setComplaintText('')
  }

  return (
    <section className="flex flex-col gap-3">
      {records.map((r) => {
        const stu = students.find((s) => s.id === r.student_id)
        const cri = criteria.find((c) => c.id === r.criteria_id)
        const open = activeComplaint === r.id
        return (
          <Card key={r.id} className="py-3 px-3">
            <CardContent className="p-0 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{stu?.student_code} {stu?.full_name}</span>
                <span className="text-muted-foreground">• {cri?.code} {cri?.name}</span>
                <span className="text-destructive font-medium">{r.points}</span>
                {r.reason && <span className="italic">“{r.reason}”</span>}
                {r.evidence_url && <a href={r.evidence_url} target="_blank" rel="noreferrer" className="underline text-primary">Minh chứng</a>}
                <span className="text-muted-foreground ml-auto">{new Date(r.created_at).toLocaleTimeString()}</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant={open ? 'default' : 'outline'} disabled={!canComplaint} onClick={() => openComplaint(r.id)}>
                        {open ? 'Đóng' : 'Khiếu nại'}
                      </Button>
                    </TooltipTrigger>
                    {!canComplaint && (
                      <TooltipContent>
                        Chỉ giáo viên chủ nhiệm có quyền khiếu nại
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
              {open && (
                <div className="flex flex-col gap-2">
                  <Separator />
                  <Input
                    placeholder="Nội dung khiếu nại..."
                    value={complaintText}
                    onChange={(e) => setComplaintText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => submitComplaint(r.id)} disabled={!complaintText.trim()}>Gửi khiếu nại</Button>
                    <Button size="sm" variant="secondary" onClick={() => openComplaint(r.id)}>Huỷ</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}
