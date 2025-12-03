"use client"

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CRITERIA_CATEGORY_OPTIONS, CRITERIA_STATUS_OPTIONS, CRITERIA_TYPE_OPTIONS } from './constants'

export type CriteriaFilterState = {
  q?: string
  category?: string
  type?: string
  status?: string
}

export function CriteriaFilters({ initial }: { initial: CriteriaFilterState }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(initial.q ?? '')
  const [category, setCategory] = useState(initial.category ?? '')
  const [type, setType] = useState(initial.type ?? '')
  const [status, setStatus] = useState(initial.status ?? '')
  const ALL_VALUE = '__all__'

  const applyFilters = (event?: React.FormEvent) => {
    event?.preventDefault()
    startTransition(() => {
      const params = new URLSearchParams()
      if (q.trim().length > 0) params.set('q', q.trim())
      if (category) params.set('category', category)
      if (type) params.set('type', type)
      if (status) params.set('status', status)
      const query = params.toString()
      router.replace(query ? `/admin/criteria?${query}` : '/admin/criteria', { scroll: false })
    })
  }

  const resetFilters = () => {
    setQ('')
    setCategory('')
    setType('')
    setStatus('')
    startTransition(() => {
      router.replace('/admin/criteria', { scroll: false })
    })
  }

  return (
    <form className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" onSubmit={applyFilters}>
      <Input
        placeholder="Tìm theo tên, mô tả, nhóm"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        disabled={isPending}
      />
      <Select value={category || ALL_VALUE} onValueChange={(value) => setCategory(value === ALL_VALUE ? '' : value)}>
        <SelectTrigger>
          <SelectValue placeholder="Phạm vi áp dụng" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>Tất cả</SelectItem>
          {CRITERIA_CATEGORY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={type || ALL_VALUE} onValueChange={(value) => setType(value === ALL_VALUE ? '' : value)}>
        <SelectTrigger>
          <SelectValue placeholder="Mức độ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>Tất cả</SelectItem>
          {CRITERIA_TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={status || ALL_VALUE} onValueChange={(value) => setStatus(value === ALL_VALUE ? '' : value)}>
        <SelectTrigger>
          <SelectValue placeholder="Trạng thái" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>Tất cả</SelectItem>
          {CRITERIA_STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="submit" disabled={isPending} className="sm:flex-1">
          Áp dụng lọc
        </Button>
        <Button type="button" variant="outline" onClick={resetFilters} disabled={isPending} className="sm:flex-1">
          Xóa lọc
        </Button>
      </div>
    </form>
  )
}
