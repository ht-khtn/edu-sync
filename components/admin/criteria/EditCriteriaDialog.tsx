"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useFormStatus } from 'react-dom'
import { updateCriteriaAction } from '@/app/(admin)/admin/actions'
import { CRITERIA_CATEGORY_OPTIONS, CRITERIA_TYPE_OPTIONS } from './constants'
import type { Criteria } from '@/lib/violations'
import { Pencil } from 'lucide-react'

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Đang lưu...' : label}
    </Button>
  )
}

export function EditCriteriaDialog({ criteria }: { criteria: Criteria }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={(e) => e.stopPropagation()}
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Chỉnh sửa</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa tiêu chí</DialogTitle>
          <DialogDescription>Cập nhật thông tin tiêu chí vi phạm</DialogDescription>
        </DialogHeader>
        <form action={updateCriteriaAction} className="space-y-4">
          <input type="hidden" name="id" value={criteria.id} />
          <div className="space-y-2">
            <Label htmlFor={`criteria-name-${criteria.id}`}>Tên tiêu chí</Label>
            <Input
              id={`criteria-name-${criteria.id}`}
              name="name"
              defaultValue={criteria.name}
              required
              minLength={3}
              maxLength={160}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`criteria-description-${criteria.id}`}>Mô tả</Label>
            <Textarea
              id={`criteria-description-${criteria.id}`}
              name="description"
              rows={3}
              defaultValue={criteria.description || ''}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`criteria-score-${criteria.id}`}>Điểm trừ</Label>
              <Input
                id={`criteria-score-${criteria.id}`}
                name="score"
                type="number"
                min={1}
                step={1}
                defaultValue={Math.abs(criteria.points)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Phạm vi áp dụng</Label>
              <Select name="category" defaultValue={criteria.category || CRITERIA_CATEGORY_OPTIONS[0].value}>
                <SelectTrigger>
                  <SelectValue />
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
              <Select name="type" defaultValue={criteria.type || CRITERIA_TYPE_OPTIONS[0].value}>
                <SelectTrigger>
                  <SelectValue />
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
              <Label htmlFor={`criteria-group-${criteria.id}`}>Nhóm</Label>
              <Input id={`criteria-group-${criteria.id}`} name="group" defaultValue={criteria.group || ''} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`criteria-subgroup-${criteria.id}`}>Nhóm con</Label>
              <Input id={`criteria-subgroup-${criteria.id}`} name="subgroup" defaultValue={criteria.subgroup || ''} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">Trạng thái</Label>
              <div className="flex h-10 items-center gap-3 rounded-md border px-3">
                <Switch name="isActive" defaultChecked={criteria.isActive} />
                <span className="text-sm">Đang sử dụng</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <SubmitButton label="Cập nhật" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
