"use client"

import React from 'react'
import { useState, useEffect } from 'react'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'

type AggRow = { id: string; name: string; total: number; count: number }

export default function ClassAggClient({ classAgg }: { classAgg: AggRow[] }) {
  // Default base score assumed to be 0. If you'd prefer 100, change initial state.
  const [useBase, setUseBase] = useState(false)
  const [baseScoreStr, setBaseScoreStr] = useState('0')

  // Persist toggle + base score in localStorage so user input is remembered
  const STORAGE_KEY = 'violationStats.settings'

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (typeof parsed.useBase === 'boolean') setUseBase(parsed.useBase)
        if (typeof parsed.baseScoreStr === 'string') setBaseScoreStr(parsed.baseScoreStr)
      }
    } catch (e) {
      // ignore parse errors
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ useBase, baseScoreStr }))
    } catch (e) {
      // ignore quota errors
    }
  }, [useBase, baseScoreStr])

  const baseScore = Number(baseScoreStr) || 0

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <label className="flex items-center gap-2">
          <Switch checked={useBase} onCheckedChange={(v) => setUseBase(Boolean(v))} />
          <span className="text-sm">Dùng điểm cơ sở</span>
        </label>

        <div className="w-36">
          <Input
            aria-label="Điểm cơ sở"
            value={baseScoreStr}
            onChange={(e) => {
              setBaseScoreStr(e.target.value)
              // enable the toggle when user modifies the base score so totals update
              setUseBase(true)
            }}
            type="number"
            className="h-8 text-sm"
          />
        </div>
        <div className="text-sm text-muted-foreground">(Tổng hiển thị = điểm cơ sở - tổng điểm trừ)</div>
      </div>

      <div className="border rounded-md bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lớp</TableHead>
              <TableHead className="text-right">Số lần</TableHead>
              <TableHead className="text-right">Tổng điểm</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classAgg.map((c) => {
              const totalDeduction = Number(c.total || 0)
              const displayed = useBase ? baseScore - totalDeduction : totalDeduction
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right">{c.count}</TableCell>
                  <TableCell className="text-right">{displayed}</TableCell>
                </TableRow>
              )
            })}
            {classAgg.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-sm text-muted-foreground">Không có dữ liệu.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
