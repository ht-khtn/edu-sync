"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFormStatus } from 'react-dom'
import { createCriteriaAction } from '@/app/(admin)/admin/actions'
import { CRITERIA_CATEGORY_OPTIONS, CRITERIA_TYPE_OPTIONS } from './constants'

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Đang lưu...' : label}
    </Button>
  )
}

export function CreateCriteriaDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Tạo tiêu chí</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Thêm tiêu chí vi phạm</DialogTitle>
        </DialogHeader>
        <form action={createCriteriaAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="criteria-name">Tên tiêu chí</Label>
            <Input id="criteria-name" name="name" required minLength={3} maxLength={160} placeholder="Ví dụ: Không đúng đồng phục" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="criteria-description">Mô tả</Label>
            <Textarea id="criteria-description" name="description" rows={3} placeholder="Mô tả chi tiết để người ghi nhận hiểu đúng" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="criteria-score">Điểm trừ</Label>
              <Input id="criteria-score" name="score" type="number" min={1} step={1} required placeholder="Ví dụ: 2" />
            </div>
            <div className="space-y-2">
              <Label>Phạm vi áp dụng</Label>
              <Select name="category" defaultValue={CRITERIA_CATEGORY_OPTIONS[0].value}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn phạm vi" />
                </SelectTrigger>
                <SelectContent>
                  {CRITERIA_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Mức độ</Label>
              <Select name="type" defaultValue={CRITERIA_TYPE_OPTIONS[0].value}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn mức độ" />
                </SelectTrigger>
                <SelectContent>
                  {CRITERIA_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="criteria-group">Nhóm</Label>
              <Input id="criteria-group" name="group" placeholder="Ví dụ: Nề nếp" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="criteria-subgroup">Nhóm con</Label>
            <Input id="criteria-subgroup" name="subgroup" placeholder="Ví dụ: Đồng phục" />
          </div>
          <DialogFooter>
            <SubmitButton label="Lưu tiêu chí" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
